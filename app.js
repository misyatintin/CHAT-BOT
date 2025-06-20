const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/auth', require('./routes/auth'));
app.use('/api/chatbot', require('./routes/chatbot'));
app.use('/api/document', require('./routes/document'));
app.use('/embed', require('./routes/embed'));

// HTML Page Routes
app.get(['/', '/login'], (req, res) => {
    res.sendFile(path.join(__dirname, 'views/auth/login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/auth/register.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/dashboard/index.html'));
});


// Start server
const { testConnection, initializeTables } = require('./config/database');

async function startServer() {
    try {
        await testConnection();
        console.log('Database connection established');
        await initializeTables();
        console.log('Database tables initialized');
        app.listen(process.env.PORT || 3001, () => {
            console.log(`Server running on port ${process.env.PORT || '3001'}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();