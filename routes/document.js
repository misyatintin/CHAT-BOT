const express = require('express');
const { executeQuery } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { upload, handleUploadError, cleanupFile } = require('../middleware/upload');
const AIProcessor = require('../utils/aiProcessor');
const PDFProcessor = require('../utils/pdfProcessor');
const LinkScraper = require('../utils/linkScraper');
const router = express.Router();

// Upload PDF document
router.post('/upload-pdf', authenticateToken, upload.single('pdf'), handleUploadError, async (req, res) => {
    let filePath = null;
    
    try {
        const { chatbotId } = req.body;
        const userId = req.user.id;

        if (!chatbotId) {
            return res.status(400).json({ error: 'Chatbot ID is required' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'PDF file is required' });
        }

        filePath = req.file.path;

        // Verify chatbot belongs to user
        const chatbots = await executeQuery(
            'SELECT id FROM chatbots WHERE id = ? AND user_id = ?',
            [chatbotId, userId]
        );

        if (chatbots.length === 0) {
            cleanupFile(filePath);
            return res.status(404).json({ error: 'Chatbot not found' });
        }

        // Initialize processors
        const pdfProcessor = new PDFProcessor();
        const aiProcessor = new AIProcessor();

        // Validate PDF
        pdfProcessor.validatePDF(filePath);

        // Create document record
        const documentResult = await executeQuery(
            'INSERT INTO documents (chatbot_id, type, file_path, original_name, status) VALUES (?, ?, ?, ?, ?)',
            [chatbotId, 'pdf', filePath, req.file.originalname, 'processing']
        );

        const documentId = documentResult.insertId;

        // Process PDF in background
        processDocumentAsync(documentId, pdfProcessor, aiProcessor, filePath);

        res.status(201).json({
            success: true,
            message: 'PDF upload started. Processing in background.',
            documentId
        });

    } catch (error) {
        console.error('PDF upload error:', error);
        
        if (filePath) {
            cleanupFile(filePath);
        }
        
        if (error.message.includes('too large') || error.message.includes('Invalid file type')) {
            return res.status(400).json({ error: error.message });
        }
        
        res.status(500).json({ error: 'Failed to upload PDF' });
    }
});

// Add link document
router.post('/add-link', authenticateToken, async (req, res) => {
    try {
        const { chatbotId, url } = req.body;
        const userId = req.user.id;

        if (!chatbotId || !url) {
            return res.status(400).json({ error: 'Chatbot ID and URL are required' });
        }

        // Verify chatbot belongs to user
        const chatbots = await executeQuery(
            'SELECT id FROM chatbots WHERE id = ? AND user_id = ?',
            [chatbotId, userId]
        );

        if (chatbots.length === 0) {
            return res.status(404).json({ error: 'Chatbot not found' });
        }

        // Check if URL is already processed for this chatbot
        const existingDocs = await executeQuery(
            'SELECT id FROM documents WHERE chatbot_id = ? AND source_url = ?',
            [chatbotId, url]
        );

        if (existingDocs.length > 0) {
            return res.status(409).json({ error: 'This URL has already been added to this chatbot' });
        }

        // Initialize processors
        const linkScraper = new LinkScraper();
        const aiProcessor = new AIProcessor();

        // Create document record
        const documentResult = await executeQuery(
            'INSERT INTO documents (chatbot_id, type, source_url, status) VALUES (?, ?, ?, ?)',
            [chatbotId, 'link', url, 'processing']
        );

        const documentId = documentResult.insertId;

        // Process link in background
        processLinkAsync(documentId, linkScraper, aiProcessor, url);

        res.status(201).json({
            success: true,
            message: 'Link processing started. This may take a few moments.',
            documentId
        });

    } catch (error) {
        console.error('Link addition error:', error);
        res.status(500).json({ error: 'Failed to add link' });
    }
});

// Get documents for a chatbot
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

        const documents = await executeQuery(`
            SELECT 
                id, 
                type, 
                source_url, 
                original_name, 
                status, 
                error_message,
                created_at,
                updated_at
            FROM documents 
            WHERE chatbot_id = ? 
            ORDER BY created_at DESC
        `, [chatbotId]);

        res.json({
            success: true,
            documents
        });

    } catch (error) {
        console.error('Get documents error:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

// Delete document
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const documentId = req.params.id;
        const userId = req.user.id;

        // Get document with chatbot ownership check
        const documents = await executeQuery(`
            SELECT d.*, c.user_id 
            FROM documents d 
            JOIN chatbots c ON d.chatbot_id = c.id 
            WHERE d.id = ? AND c.user_id = ?
        `, [documentId, userId]);

        if (documents.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const document = documents[0];

        // Clean up file if it exists
        if (document.file_path) {
            cleanupFile(document.file_path);
        }

        // Delete from database
        await executeQuery('DELETE FROM documents WHERE id = ?', [documentId]);

        res.json({
            success: true,
            message: 'Document deleted successfully'
        });

    } catch (error) {
        console.error('Delete document error:', error);
        res.status(500).json({ error: 'Failed to delete document' });
    }
});

// Get document processing status
router.get('/status/:id', authenticateToken, async (req, res) => {
    try {
        const documentId = req.params.id;
        const userId = req.user.id;

        const documents = await executeQuery(`
            SELECT d.id, d.status, d.error_message, d.created_at, d.updated_at
            FROM documents d 
            JOIN chatbots c ON d.chatbot_id = c.id 
            WHERE d.id = ? AND c.user_id = ?
        `, [documentId, userId]);

        if (documents.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        res.json({
            success: true,
            document: documents[0]
        });

    } catch (error) {
        console.error('Get document status error:', error);
        res.status(500).json({ error: 'Failed to get document status' });
    }
});

// Reprocess failed document
router.post('/reprocess/:id', authenticateToken, async (req, res) => {
    try {
        const documentId = req.params.id;
        const userId = req.user.id;

        const documents = await executeQuery(`
            SELECT d.*, c.user_id 
            FROM documents d 
            JOIN chatbots c ON d.chatbot_id = c.id 
            WHERE d.id = ? AND c.user_id = ?
        `, [documentId, userId]);

        if (documents.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const document = documents[0];

        if (document.status !== 'failed') {
            return res.status(400).json({ error: 'Only failed documents can be reprocessed' });
        }

        // Update status to processing
        await executeQuery(
            'UPDATE documents SET status = ?, error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['processing', documentId]
        );

        // Initialize processors
        const aiProcessor = new AIProcessor();

        if (document.type === 'pdf') {
            const pdfProcessor = new PDFProcessor();
            processDocumentAsync(documentId, pdfProcessor, aiProcessor, document.file_path);
        } else if (document.type === 'link') {
            const linkScraper = new LinkScraper();
            processLinkAsync(documentId, linkScraper, aiProcessor, document.source_url);
        }

        res.json({
            success: true,
            message: 'Document reprocessing started'
        });

    } catch (error) {
        console.error('Reprocess document error:', error);
        res.status(500).json({ error: 'Failed to reprocess document' });
    }
});

// Async function to process PDF documents
async function processDocumentAsync(documentId, pdfProcessor, aiProcessor, filePath) {
    try {
        // Extract text from PDF
        const extractedText = await pdfProcessor.extractText(filePath);
        
        if (!extractedText || extractedText.trim().length === 0) {
            throw new Error('No text could be extracted from the PDF');
        }

        // Extract metadata
        const metadata = await pdfProcessor.extractMetadata(filePath);

        // Process with AI
        const processedContent = await aiProcessor.processDocument(extractedText);

        // Update document record
        await executeQuery(
            'UPDATE documents SET processed_content = ?, metadata = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [processedContent, JSON.stringify(metadata), 'completed', documentId]
        );

        console.log(`Document ${documentId} processed successfully`);

    } catch (error) {
        console.error(`Document processing failed for ${documentId}:`, error);
        
        // Update document with error
        await executeQuery(
            'UPDATE documents SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['failed', error.message, documentId]
        );

        // Clean up file on error
        if (filePath) {
            cleanupFile(filePath);
        }
    }
}

// Async function to process link documents
async function processLinkAsync(documentId, linkScraper, aiProcessor, url) {
    try {
        // Scrape content from URL
        const scrapedData = await linkScraper.scrapeContent(url);
        
        if (!scrapedData.content || scrapedData.content.trim().length === 0) {
            throw new Error('No content could be extracted from the URL');
        }

        // Get metadata
        const metadata = await linkScraper.getMetadata(url);

        // Process with AI
        const processedContent = await aiProcessor.processDocument(scrapedData.content);

        // Update document record
        await executeQuery(
            'UPDATE documents SET processed_content = ?, metadata = ?, original_name = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [processedContent, JSON.stringify(metadata), scrapedData.title, 'completed', documentId]
        );

        console.log(`Link ${documentId} processed successfully`);

    } catch (error) {
        console.error(`Link processing failed for ${documentId}:`, error);
        
        // Update document with error
        await executeQuery(
            'UPDATE documents SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['failed', error.message, documentId]
        );
    }
}

module.exports = router;