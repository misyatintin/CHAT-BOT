const { executeQuery } = require('../config/database');

class Chatbot {
    static async create({ userId, name, description, websiteUrl, embedCode }) {
        const result = await executeQuery(
            'INSERT INTO chatbots (user_id, name, description, website_url, embed_code) VALUES (?, ?, ?, ?, ?)',
            [userId, name, description, websiteUrl, embedCode]
        );
        return result.insertId;
    }

    static async findById(id) {
        const chatbots = await executeQuery(
            'SELECT * FROM chatbots WHERE id = ?',
            [id]
        );
        return chatbots[0] || null;
    }

    static async findByUserId(userId) {
        return await executeQuery(
            'SELECT * FROM chatbots WHERE user_id = ?',
            [userId]
        );
    }
}

module.exports = Chatbot;