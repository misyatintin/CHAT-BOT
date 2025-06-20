const AIProcessor = require('../utils/aiProcessor');
const PDFProcessor = require('../utils/pdfProcessor');
const LinkScraper = require('../utils/linkScraper');
const db = require('../config/database');

class DocumentController {
    static async uploadDocument(req, res) {
        try {
            const { chatbotId, type, sourceUrl } = req.body;
            const aiProcessor = new AIProcessor();
            
            let content = '';
            
            if (type === 'pdf' && req.file) {
                const pdfProcessor = new PDFProcessor();
                content = await pdfProcessor.extractText(req.file.path);
            } else if (type === 'link' && sourceUrl) {
                const linkScraper = new LinkScraper();
                content = await linkScraper.scrapeContent(sourceUrl);
            }

            // Process with AI
            const processedContent = await aiProcessor.processDocument(content);

            // Save to database
            const query = `
                INSERT INTO documents (chatbot_id, type, source_url, file_path, processed_content, status)
                VALUES (?, ?, ?, ?, ?, 'completed')
            `;
            
            await db.execute(query, [
                chatbotId,
                type,
                sourceUrl || null,
                req.file?.path || null,
                processedContent
            ]);

            res.json({ success: true, message: 'Document processed successfully' });
        } catch (error) {
            console.error('Document upload error:', error);
            res.status(500).json({ error: 'Failed to process document' });
        }
    }
}

module.exports = DocumentController;