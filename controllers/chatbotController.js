const AIProcessor = require('../utils/aiProcessor');
const db = require('../config/database');

class ChatbotController {
    static async createChatbot(req, res) {
        try {
            const { name, description, websiteUrl } = req.body;
            const userId = req.user.id;

            // Generate embed code
            const embedCode = `
<div id="ai-chatbot-${Date.now()}"></div>
<script>
(function() {
    var script = document.createElement('script');
    script.src = '${process.env.BASE_URL}/embed/chatbot.js';
    script.setAttribute('data-chatbot-id', '{{CHATBOT_ID}}');
    document.head.appendChild(script);
})();
</script>`;

            const query = `
                INSERT INTO chatbots (user_id, name, description, website_url, embed_code)
                VALUES (?, ?, ?, ?, ?)
            `;

            const [result] = await db.execute(query, [
                userId, name, description, websiteUrl, embedCode
            ]);

            // Update embed code with actual chatbot ID
            const finalEmbedCode = embedCode.replace('{{CHATBOT_ID}}', result.insertId);
            
            await db.execute(
                'UPDATE chatbots SET embed_code = ? WHERE id = ?',
                [finalEmbedCode, result.insertId]
            );

            res.json({ 
                success: true, 
                chatbotId: result.insertId,
                embedCode: finalEmbedCode
            });
        } catch (error) {
            console.error('Chatbot creation error:', error);
            res.status(500).json({ error: 'Failed to create chatbot' });
        }
    }

    static async chatResponse(req, res) {
        try {
            const { chatbotId, message } = req.body;
            const aiProcessor = new AIProcessor();

            // Get chatbot context from documents
            const [documents] = await db.execute(
                'SELECT processed_content FROM documents WHERE chatbot_id = ? AND status = "completed"',
                [chatbotId]
            );

            const context = documents.map(doc => doc.processed_content).join('\n\n');
            
            // Generate AI response with chatbot ID for Q&A integration      
           const response = await aiProcessor.generateResponse(context, message, chatbotId);

            // Save conversation
            await db.execute(
                'INSERT INTO conversations (chatbot_id, user_message, bot_response) VALUES (?, ?, ?)',
                [chatbotId, message, response]
            );

            res.json({ response });
        } catch (error) {
            console.error('Chat response error:', error);
            res.status(500).json({ error: 'Failed to generate response' });
        }
    }
}

module.exports = ChatbotController;