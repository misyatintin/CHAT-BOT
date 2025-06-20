const jwt = require('jsonwebtoken');
const { executeQuery } = require('../config/database');

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Verify user still exists in database
        const user = await executeQuery(
            'SELECT id, username, email FROM users WHERE id = ?',
            [decoded.userId]
        );

        if (user.length === 0) {
            return res.status(401).json({ error: 'Invalid token - user not found' });
        }

        req.user = {
            id: decoded.userId,
            username: user[0].username,
            email: user[0].email
        };
        
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        
        return res.status(500).json({ error: 'Token verification failed' });
    }
};

const generateToken = (userId) => {
    return jwt.sign(
        { userId: userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
};

const generateRefreshToken = (userId) => {
    return jwt.sign(
        { userId: userId, type: 'refresh' },
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
};

// Optional middleware for chatbot access (less strict)
const authenticateChatbot = async (req, res, next) => {
    const { chatbotId } = req.body || req.params;
    
    if (!chatbotId) {
        return res.status(400).json({ error: 'Chatbot ID required' });
    }

    try {
        // Verify chatbot exists and is active
        const chatbot = await executeQuery(
            'SELECT id, name, is_active FROM chatbots WHERE id = ? AND is_active = TRUE',
            [chatbotId]
        );

        if (chatbot.length === 0) {
            return res.status(404).json({ error: 'Chatbot not found or inactive' });
        }

        req.chatbot = chatbot[0];
        next();
    } catch (error) {
        console.error('Chatbot authentication error:', error);
        return res.status(500).json({ error: 'Chatbot verification failed' });
    }
};

module.exports = {
    authenticateToken,
    authenticateChatbot,
    generateToken,
    generateRefreshToken
};