const express = require('express');
const { executeQuery } = require('../config/database');
const { authenticateToken, authenticateChatbot } = require('../middleware/auth');
const AIProcessor = require('../utils/aiProcessor');
const router = express.Router();

// Create new chatbot
router.post('/create', authenticateToken, async (req, res) => {
    try {
        const { name, description, websiteUrl } = req.body;
        const userId = req.user.id;

        // Validation
        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: 'Chatbot name is required' });
        }

        if (name.length > 255) {
            return res.status(400).json({ error: 'Chatbot name is too long' });
        }

        // Create chatbot
        const result = await executeQuery(
            'INSERT INTO chatbots (user_id, name, description, website_url) VALUES (?, ?, ?, ?)',
            [userId, name.trim(), description?.trim() || null, websiteUrl?.trim() || null]
        );

        const chatbotId = result.insertId;

        // Generate embed code
        const embedCode = `<div id="ai-chatbot-${chatbotId}"></div>
<script>
(function() {
    var script = document.createElement('script');
    script.src = '${process.env.BASE_URL || 'http://localhost:3000'}/embed/chatbot-widget.js';
    script.setAttribute('data-chatbot-id', '${chatbotId}');
    document.head.appendChild(script);
})();
</script>`;

        // Update chatbot with embed code
        await executeQuery(
            'UPDATE chatbots SET embed_code = ? WHERE id = ?',
            [embedCode, chatbotId]
        );

        res.status(201).json({
            success: true,
            message: 'Chatbot created successfully',
            chatbot: {
                id: chatbotId,
                name,
                description,
                websiteUrl,
                embedCode
            }
        });

    } catch (error) {
        console.error('Chatbot creation error:', error);
        res.status(500).json({ error: 'Failed to create chatbot' });
    }
});

// Get user's chatbots
router.get('/list', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const chatbots = await executeQuery(`
            SELECT 
                c.*,
                COUNT(d.id) as document_count,
                COUNT(conv.id) as conversation_count
            FROM chatbots c
            LEFT JOIN documents d ON c.id = d.chatbot_id AND d.status = 'completed'
            LEFT JOIN conversations conv ON c.id = conv.chatbot_id
            WHERE c.user_id = ?
            GROUP BY c.id
            ORDER BY c.created_at DESC
        `, [userId]);

        res.json({
            success: true,
            chatbots
        });

    } catch (error) {
        console.error('Get chatbots error:', error);
        res.status(500).json({ error: 'Failed to fetch chatbots' });
    }
});

// Get single chatbot details
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const chatbotId = req.params.id;
        const userId = req.user.id;

        const chatbots = await executeQuery(
            'SELECT * FROM chatbots WHERE id = ? AND user_id = ?',
            [chatbotId, userId]
        );

        if (chatbots.length === 0) {
            return res.status(404).json({ error: 'Chatbot not found' });
        }

        // Get documents for this chatbot
        const documents = await executeQuery(
            'SELECT id, type, source_url, original_name, status, created_at FROM documents WHERE chatbot_id = ?',
            [chatbotId]
        );

        // Get recent conversations
        const conversations = await executeQuery(
            'SELECT user_message, bot_response, created_at FROM conversations WHERE chatbot_id = ? ORDER BY created_at DESC LIMIT 10',
            [chatbotId]
        );

        res.json({
            success: true,
            chatbot: {
                ...chatbots[0],
                documents,
                recentConversations: conversations
            }
        });

    } catch (error) {
        console.error('Get chatbot error:', error);
        res.status(500).json({ error: 'Failed to fetch chatbot details' });
    }
});

// Update chatbot
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const chatbotId = req.params.id;
        const userId = req.user.id;
        const { name, description, websiteUrl, isActive } = req.body;

        // Check if chatbot belongs to user
        const chatbots = await executeQuery(
            'SELECT id FROM chatbots WHERE id = ? AND user_id = ?',
            [chatbotId, userId]
        );

        if (chatbots.length === 0) {
            return res.status(404).json({ error: 'Chatbot not found' });
        }

        // Build update query dynamically
        const updates = [];
        const values = [];

        if (name !== undefined) {
            if (!name || name.trim().length === 0) {
                return res.status(400).json({ error: 'Chatbot name is required' });
            }
            updates.push('name = ?');
            values.push(name.trim());
        }

        if (description !== undefined) {
            updates.push('description = ?');
            values.push(description?.trim() || null);
        }

        if (websiteUrl !== undefined) {
            updates.push('website_url = ?');
            values.push(websiteUrl?.trim() || null);
        }

        if (isActive !== undefined) {
            updates.push('is_active = ?');
            values.push(Boolean(isActive));
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(chatbotId);

        await executeQuery(
            `UPDATE chatbots SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        res.json({
            success: true,
            message: 'Chatbot updated successfully'
        });

    } catch (error) {
        console.error('Update chatbot error:', error);
        res.status(500).json({ error: 'Failed to update chatbot' });
    }
});

// Delete chatbot
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const chatbotId = req.params.id;
        const userId = req.user.id;

        // Check if chatbot belongs to user
        const chatbots = await executeQuery(
            'SELECT id FROM chatbots WHERE id = ? AND user_id = ?',
            [chatbotId, userId]
        );

        if (chatbots.length === 0) {
            return res.status(404).json({ error: 'Chatbot not found' });
        }

        // Delete chatbot (cascade will handle related records)
        await executeQuery('DELETE FROM chatbots WHERE id = ?', [chatbotId]);

        res.json({
            success: true,
            message: 'Chatbot deleted successfully'
        });

    } catch (error) {
        console.error('Delete chatbot error:', error);
        res.status(500).json({ error: 'Failed to delete chatbot' });
    }
});

// Chat endpoint (public, for embedded chatbots)
router.post('/chat', authenticateChatbot, async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { chatbotId, message, sessionId } = req.body;

        if (!message || message.trim().length === 0) {
            return res.status(400).json({ error: 'Message is required' });
        }

        if (message.length > 1000) {
            return res.status(400).json({ error: 'Message is too long' });
        }

        const aiProcessor = new AIProcessor();

        // Get chatbot context from documents
        const documents = await executeQuery(
            'SELECT processed_content FROM documents WHERE chatbot_id = ? AND status = "completed"',
            [chatbotId]
        );

        let context = '';
        if (documents.length > 0) {
            context = documents.map(doc => doc.processed_content).join('\n\n');
        } else {
            context = 'No specific context available. Please provide general helpful responses.';
        }

        // Generate AI response with Q&A integration
        const response = await aiProcessor.generateResponse(context, message.trim(), chatbotId);
        const responseTime = Date.now() - startTime;

        // Save conversation
        await executeQuery(
            'INSERT INTO conversations (chatbot_id, session_id, user_message, bot_response, response_time) VALUES (?, ?, ?, ?, ?)',
            [chatbotId, sessionId || null, message.trim(), response, responseTime]
        );

        res.json({
            success: true,
            response,
            responseTime
        });

    } catch (error) {
        console.error('Chat response error:', error);
        res.status(500).json({ 
            error: 'Failed to generate response',
            response: "I'm sorry, I'm having trouble processing your request right now. Please try again later."
        });
    }
});






router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const chatbotId = req.params.id;
        const userId = req.user.id;

        const chatbots = await executeQuery(
            'SELECT * FROM chatbots WHERE id = ? AND user_id = ?',
            [chatbotId, userId]
        );

        if (chatbots.length === 0) {
            return res.status(404).json({ error: 'Chatbot not found' });
        }

        // Get documents for this chatbot
        const documents = await executeQuery(
            'SELECT id, type, source_url, original_name, status, created_at FROM documents WHERE chatbot_id = ?',
            [chatbotId]
        );

        // Get recent conversations
        const conversations = await executeQuery(
            'SELECT user_message, bot_response, created_at FROM conversations WHERE chatbot_id = ? ORDER BY created_at DESC LIMIT 10',
            [chatbotId]
        );

        // Get Q&A count
        const [qaCount] = await executeQuery(
            'SELECT COUNT(*) as count FROM chatbot_qa WHERE chatbot_id = ? AND is_active = 1',
            [chatbotId]
        );

        res.json({
            success: true,
            chatbot: {
                ...chatbots[0],
                documents,
                recentConversations: conversations,
                qaCount: qaCount.count
            }
        });

    } catch (error) {
        console.error('Get chatbot error:', error);
        res.status(500).json({ error: 'Failed to fetch chatbot details' });
    }
});






// Get chatbot analytics
router.get('/:id/analytics', authenticateToken, async (req, res) => {
    try {
        const chatbotId = req.params.id;
        const userId = req.user.id;

        // Verify ownership
        const chatbots = await executeQuery(
            'SELECT id FROM chatbots WHERE id = ? AND user_id = ?',
            [chatbotId, userId]
        );

        if (chatbots.length === 0) {
            return res.status(404).json({ error: 'Chatbot not found' });
        }

        // Get analytics data
        const [totalConversations] = await executeQuery(
            'SELECT COUNT(*) as count FROM conversations WHERE chatbot_id = ?',
            [chatbotId]
        );

        const [avgResponseTime] = await executeQuery(
            'SELECT AVG(response_time) as avg_time FROM conversations WHERE chatbot_id = ? AND response_time > 0',
            [chatbotId]
        );

        const dailyStats = await executeQuery(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as conversations
            FROM conversations 
            WHERE chatbot_id = ? 
                AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `, [chatbotId]);

        const [documentCount] = await executeQuery(
            'SELECT COUNT(*) as count FROM documents WHERE chatbot_id = ? AND status = "completed"',
            [chatbotId]
        );

        res.json({
            success: true,
            analytics: {
                totalConversations: totalConversations.count,
                averageResponseTime: Math.round(avgResponseTime.avg_time || 0),
                documentsProcessed: documentCount.count,
                dailyStats
            }
        });

    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

module.exports = router;