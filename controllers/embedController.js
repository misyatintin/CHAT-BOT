const { executeQuery } = require('../config/database');

class EmbedController {
    static async serveWidget(req, res) {
        try {
            const chatbotId = req.query.chatbotId;

            if (!chatbotId) {
                return res.status(400).json({ error: 'Chatbot ID is required' });
            }

            // Verify chatbot exists and is active
            const chatbots = await executeQuery(
                'SELECT id, name FROM chatbots WHERE id = ? AND is_active = TRUE',
                [chatbotId]
            );

            if (chatbots.length === 0) {
                return res.status(404).json({ error: 'Chatbot not found or inactive' });
            }

            // Serve the widget HTML
            res.sendFile('chatbot-widget.html', { root: './views/embed' });
        } catch (error) {
            console.error('Serve widget error:', error);
            res.status(500).json({ error: 'Failed to serve chatbot widget' });
        }
    }
}

module.exports = EmbedController;