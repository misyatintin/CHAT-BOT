(function() {
    const chatbotId = document.currentScript.getAttribute('data-chatbot-id');
    
    // Create chatbot widget
    const widget = document.createElement('div');
    widget.innerHTML = `
        <div id="chatbot-widget" style="
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 300px;
            height: 400px;
            background: white;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            display: none;
            flex-direction: column;
        ">
            <div class="chat-header" style="
                background: #007bff;
                color: white;
                padding: 15px;
                border-radius: 10px 10px 0 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <span>AI Assistant</span>
                <button onclick="toggleChat()" style="background: none; border: none; color: white; font-size: 18px;">×</button>
            </div>
            <div class="chat-messages" id="chatMessages" style="
                flex: 1;
                padding: 15px;
                overflow-y: auto;
                max-height: 300px;
            "></div>
            <div class="chat-input" style="
                padding: 15px;
                border-top: 1px solid #eee;
            ">
                <div style="display: flex; gap: 10px;">
                    <input type="text" id="messageInput" placeholder="Type your message..." style="
                        flex: 1;
                        padding: 8px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                    ">
                    <button onclick="sendMessage()" style="
                        background: #007bff;
                        color: white;
                        border: none;
                        padding: 8px 15px;
                        border-radius: 4px;
                        cursor: pointer;
                    ">Send</button>
                </div>
            </div>
        </div>
        <button id="chatToggle" onclick="toggleChat()" style="
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: #007bff;
            color: white;
            border: none;
            font-size: 24px;
            cursor: pointer;
            z-index: 10001;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        ">💬</button>
    `;
    
    document.body.appendChild(widget);

    // Chat functionality
    window.toggleChat = function() {
        const chatWidget = document.getElementById('chatbot-widget');
        const chatToggle = document.getElementById('chatToggle');
        
        if (chatWidget.style.display === 'none' || !chatWidget.style.display) {
            chatWidget.style.display = 'flex';
            chatToggle.style.display = 'none';
        } else {
            chatWidget.style.display = 'none';
            chatToggle.style.display = 'block';
        }
    };

    window.sendMessage = async function() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();
        
        if (!message) return;

        // Add user message to chat
        addMessage(message, 'user');
        input.value = '';

        try {
            // Send to backend
            const response = await fetch('/api/chatbot/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    chatbotId: chatbotId,
                    message: message
                })
            });

            const data = await response.json();
            addMessage(data.response, 'bot');
        } catch (error) {
            addMessage('Sorry, there was an error processing your request.', 'bot');
        }
    };

    function addMessage(text, sender) {
        const messagesDiv = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.style.marginBottom = '10px';
        messageDiv.style.textAlign = sender === 'user' ? 'right' : 'left';
        
        messageDiv.innerHTML = `
            <div style="
                display: inline-block;
                padding: 8px 12px;
                border-radius: 18px;
                max-width: 80%;
                word-wrap: break-word;
                background: ${sender === 'user' ? '#007bff' : '#f1f1f1'};
                color: ${sender === 'user' ? 'white' : '#333'};
            ">${text}</div>
        `;
        
        messagesDiv.appendChild(messageDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    // Enter key support
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && document.activeElement.id === 'messageInput') {
            sendMessage();
        }
    });
})();