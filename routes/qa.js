const express = require('express');
const { executeQuery } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Add new Q&A entry
router.post('/add', authenticateToken, async (req, res) => {
    try {
        const { chatbotId, question, answer } = req.body;
        const userId = req.user.id;

        // Validation
        if (!chatbotId || !question || !answer) {
            return res.status(400).json({ error: 'Chatbot ID, question, and answer are required' });
        }

        if (question.trim().length === 0 || answer.trim().length === 0) {
            return res.status(400).json({ error: 'Question and answer cannot be empty' });
        }

        // Verify chatbot belongs to user
        const chatbots = await executeQuery(
            'SELECT id FROM chatbots WHERE id = ? AND user_id = ?',
            [chatbotId, userId]
        );

        if (chatbots.length === 0) {
            return res.status(404).json({ error: 'Chatbot not found' });
        }

        // Extract keywords from question for better matching
        const keywords = extractKeywords(question.trim());

        // Insert Q&A
        const result = await executeQuery(
            'INSERT INTO chatbot_qa (chatbot_id, question, answer, keywords) VALUES (?, ?, ?, ?)',
            [chatbotId, question.trim(), answer.trim(), keywords]
        );

        res.status(201).json({
            success: true,
            message: 'Q&A added successfully',
            qa: {
                id: result.insertId,
                question: question.trim(),
                answer: answer.trim(),
                keywords
            }
        });

    } catch (error) {
        console.error('Add Q&A error:', error);
        res.status(500).json({ error: 'Failed to add Q&A' });
    }
});

// Get Q&A entries for a chatbot
router.get('/list/:chatbotId', authenticateToken, async (req, res) => {
    try {
        const { chatbotId } = req.params;
        const userId = req.user.id;

        // Verify chatbot belongs to user
        const chatbots = await executeQuery(
            'SELECT id FROM chatbots WHERE id = ? AND user_id = ?',
            [chatbotId, userId]
        );

        if (chatbots.length === 0) {
            return res.status(404).json({ error: 'Chatbot not found' });
        }

        const qaEntries = await executeQuery(
            'SELECT id, question, answer, is_active, created_at, updated_at FROM chatbot_qa WHERE chatbot_id = ? ORDER BY created_at DESC',
            [chatbotId]
        );

        res.json({
            success: true,
            qaEntries
        });

    } catch (error) {
        console.error('Get Q&A error:', error);
        res.status(500).json({ error: 'Failed to fetch Q&A entries' });
    }
});

// Update Q&A entry
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const qaId = req.params.id;
        const userId = req.user.id;
        const { question, answer, isActive } = req.body;

        // Check if Q&A belongs to user's chatbot
        const qaEntries = await executeQuery(`
            SELECT qa.id, qa.question, qa.answer 
            FROM chatbot_qa qa 
            JOIN chatbots c ON qa.chatbot_id = c.id 
            WHERE qa.id = ? AND c.user_id = ?
        `, [qaId, userId]);

        if (qaEntries.length === 0) {
            return res.status(404).json({ error: 'Q&A entry not found' });
        }

        // Build update query dynamically
        const updates = [];
        const values = [];

        if (question !== undefined) {
            if (!question || question.trim().length === 0) {
                return res.status(400).json({ error: 'Question cannot be empty' });
            }
            updates.push('question = ?');
            values.push(question.trim());
            
            // Update keywords if question changed
            updates.push('keywords = ?');
            values.push(extractKeywords(question.trim()));
        }

        if (answer !== undefined) {
            if (!answer || answer.trim().length === 0) {
                return res.status(400).json({ error: 'Answer cannot be empty' });
            }
            updates.push('answer = ?');
            values.push(answer.trim());
        }

        if (isActive !== undefined) {
            updates.push('is_active = ?');
            values.push(Boolean(isActive));
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(qaId);

        await executeQuery(
            `UPDATE chatbot_qa SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        res.json({
            success: true,
            message: 'Q&A updated successfully'
        });

    } catch (error) {
        console.error('Update Q&A error:', error);
        res.status(500).json({ error: 'Failed to update Q&A' });
    }
});

// Delete Q&A entry
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const qaId = req.params.id;
        const userId = req.user.id;

        // Check if Q&A belongs to user's chatbot
        const qaEntries = await executeQuery(`
            SELECT qa.id 
            FROM chatbot_qa qa 
            JOIN chatbots c ON qa.chatbot_id = c.id 
            WHERE qa.id = ? AND c.user_id = ?
        `, [qaId, userId]);

        if (qaEntries.length === 0) {
            return res.status(404).json({ error: 'Q&A entry not found' });
        }

        await executeQuery('DELETE FROM chatbot_qa WHERE id = ?', [qaId]);

        res.json({
            success: true,
            message: 'Q&A deleted successfully'
        });

    } catch (error) {
        console.error('Delete Q&A error:', error);
        res.status(500).json({ error: 'Failed to delete Q&A' });
    }
});

// Bulk add Q&A entries
router.post('/bulk-add', authenticateToken, async (req, res) => {
    try {
        const { chatbotId, qaEntries } = req.body;
        const userId = req.user.id;

        if (!chatbotId || !qaEntries || !Array.isArray(qaEntries) || qaEntries.length === 0) {
            return res.status(400).json({ error: 'Chatbot ID and Q&A entries array are required' });
        }

        // Verify chatbot belongs to user
        const chatbots = await executeQuery(
            'SELECT id FROM chatbots WHERE id = ? AND user_id = ?',
            [chatbotId, userId]
        );

        if (chatbots.length === 0) {
            return res.status(404).json({ error: 'Chatbot not found' });
        }

        // Validate and prepare entries
        const validEntries = [];
        for (const entry of qaEntries) {
            if (entry.question && entry.answer && entry.question.trim() && entry.answer.trim()) {
                const keywords = extractKeywords(entry.question.trim());
                validEntries.push([
                    chatbotId,
                    entry.question.trim(),
                    entry.answer.trim(),
                    keywords
                ]);
            }
        }

        if (validEntries.length === 0) {
            return res.status(400).json({ error: 'No valid Q&A entries provided' });
        }

        // Bulk insert
        const placeholders = validEntries.map(() => '(?, ?, ?, ?)').join(', ');
        const values = validEntries.flat();
        
        await executeQuery(
            `INSERT INTO chatbot_qa (chatbot_id, question, answer, keywords) VALUES ${placeholders}`,
            values
        );

        res.status(201).json({
            success: true,
            message: `${validEntries.length} Q&A entries added successfully`
        });

    } catch (error) {
        console.error('Bulk add Q&A error:', error);
        res.status(500).json({ error: 'Failed to add Q&A entries' });
    }
});

// Helper function to extract keywords from question
function extractKeywords(question) {
    // Remove common words and extract meaningful keywords
    const commonWords = ['what', 'how', 'when', 'where', 'why', 'who', 'which', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 'can', 'could', 'would', 'should', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'by', 'with'];
    
    return question
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ') // Remove punctuation
        .split(/\s+/)
        .filter(word => word.length > 2 && !commonWords.includes(word))
        .join(' ');
}

module.exports = router;