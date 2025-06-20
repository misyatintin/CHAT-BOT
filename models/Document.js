const { executeQuery } = require('../config/database');

class Document {
    static async create({ chatbotId, type, sourceUrl, filePath, originalName, status }) {
        const result = await executeQuery(
            'INSERT INTO documents (chatbot_id, type, source_url, file_path, original_name, status) VALUES (?, ?, ?, ?, ?, ?)',
            [chatbotId, type, sourceUrl, filePath, originalName, status]
        );
        return result.insertId;
    }

    static async update(id, updates) {
        const { processedContent, metadata, status, errorMessage } = updates;
        await executeQuery(
            'UPDATE documents SET processed_content = ?, metadata = ?, status = ?, error_message = ? WHERE id = ?',
            [processedContent, metadata, status, errorMessage, id]
        );
    }

    static async findByChatbotId(chatbotId) {
        return await executeQuery(
            'SELECT * FROM documents WHERE chatbot_id = ?',
            [chatbotId]
        );
    }
}

module.exports = Document;