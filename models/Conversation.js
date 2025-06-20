const { executeQuery } = require('../config/database');

class Conversation {
    static async create({ chatbotId, sessionId, userMessage, botResponse, responseTime }) {
        const result = await executeQuery(
            'INSERT INTO conversations (chatbot_id, session_id, user_message, bot_response, response_time) VALUES (?, ?, ?, ?, ?)',
            [chatbotId, sessionId, userMessage, botResponse, responseTime]
        );
        return result.insertId;
    }

    static async findByChatbotId(chatbotId, limit = 10) {
        return await executeQuery(
            'SELECT * FROM conversations WHERE chatbot_id = ? ORDER BY created_at DESC LIMIT ?',
            [chatbotId, limit]
        );
    }
}

module.exports = Conversation;