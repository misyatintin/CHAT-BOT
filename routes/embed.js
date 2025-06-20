const express = require('express');
const router = express.Router();
const EmbedController = require('../controllers/embedController');

// Serve the chatbot widget JavaScript file
router.get('/chatbot.js', (req, res) => {
    res.sendFile('chatbot-widget.js', { root: './public/js' });
});

// Serve the widget HTML
router.get('/widget', EmbedController.serveWidget);

module.exports = router;