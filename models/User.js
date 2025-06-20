const { executeQuery } = require('../config/database');

class User {
    static async create({ username, email, passwordHash }) {
        const result = await executeQuery(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            [username, email, passwordHash]
        );
        return result.insertId;
    }

    static async findByEmail(email) {
        const users = await executeQuery(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );
        return users[0] || null;
    }

    static async findById(id) {
        const users = await executeQuery(
            'SELECT id, username, email, created_at FROM users WHERE id = ?',
            [id]
        );
        return users[0] || null;
    }
}

module.exports = User;