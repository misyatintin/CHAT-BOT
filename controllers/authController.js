const bcrypt = require('bcrypt');
const { executeQuery } = require('../config/database');
const { generateToken, generateRefreshToken } = require('../middleware/auth');

class AuthController {
    static async register(req, res) {
        try {
            const { username, email, password } = req.body;

            // Validation
            if (!username || !email || !password) {
                return res.status(400).json({ error: 'All fields are required' });
            }

            if (password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters long' });
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ error: 'Invalid email format' });
            }

            // Check for existing user
            const existingUser = await executeQuery(
                'SELECT id FROM users WHERE email = ? OR username = ?',
                [email, username]
            );

            if (existingUser.length > 0) {
                return res.status(409).json({ error: 'User with this email or username already exists' });
            }

            // Hash password
            const saltRounds = 12;
            const passwordHash = await bcrypt.hash(password, saltRounds);

            // Create user
            const result = await executeQuery(
                'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
                [username, email, passwordHash]
            );

            const userId = result.insertId;
            const token = generateToken(userId);
            const refreshToken = generateRefreshToken(userId);

            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                token,
                refreshToken,
                user: { id: userId, username, email }
            });
        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({ error: 'Registration failed' });
        }
    }

    static async login(req, res) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({ error: 'Email and password are required' });
            }

            const users = await executeQuery(
                'SELECT id, username, email, password_hash FROM users WHERE email = ?',
                [email]
            );

            if (users.length === 0) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            const user = users[0];
            const isValidPassword = await bcrypt.compare(password, user.password_hash);

            if (!isValidPassword) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            const token = generateToken(user.id);
            const refreshToken = generateRefreshToken(user.id);

            res.json({
                success: true,
                message: 'Login successful',
                token,
                refreshToken,
                user: { id: user.id, username: user.username, email: user.email }
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Login failed' });
        }
    }
}

module.exports = AuthController;