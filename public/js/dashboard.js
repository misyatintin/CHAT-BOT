document.addEventListener('DOMContentLoaded', () => {
    loadChatbots();
    document.getElementById('createBotForm').addEventListener('submit', createChatbot);
});

let currentChatbotId = null;

async function createChatbot(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    try {
        const response = await fetch('/api/chatbot/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                name: formData.get('name'),
                description: formData.get('description'),
                websiteUrl: formData.get('websiteUrl')
            })
        });

        const data = await response.json();
        if (data.success) {
            alert('Chatbot created successfully!');
            currentChatbotId = data.chatbot.id;
            form.reset();
            loadChatbots();
            
            // Show document upload section
            document.getElementById('documentUploadSection').style.display = 'block';
            setupDocumentUpload();
        } else {
            alert(data.error || 'Failed to create chatbot');
        }
    } catch (error) {
        console.error('Create chatbot error:', error);
        alert('An error occurred while creating the chatbot');
    }
}


async function loadChatbots() {
    try {
        const response = await fetch('/api/chatbot/list', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        const data = await response.json();
        const chatbotList = document.getElementById('chatbotList');

        if (data.success) {
            chatbotList.innerHTML = data.chatbots.map(bot => `
                <div class="chatbot-item">
                    <h3>${bot.name}</h3>
                    <p>${bot.description || 'No description'}</p>
                    <p>Website: ${bot.website_url || 'None'}</p>
                    <p>Documents: ${bot.document_count}</p>
                    <p>Conversations: ${bot.conversation_count}</p>
                    <button onclick="copyEmbedCode(${bot.id})">Copy Embed Code</button>
                    <button onclick="showEmbedCode(${bot.id})">Show Embed Code</button>
                </div>
            `).join('');
        } else {
            chatbotList.innerHTML = '<p>No chatbots found</p>';
        }
    } catch (error) {
        console.error('Load chatbots error:', error);
        const chatbotList = document.getElementById('chatbotList');
        chatbotList.innerHTML = '<p>Error loading chatbots</p>';
    }
}

// Enhanced copy function with multiple fallback methods
async function copyEmbedCode(botId) {
    try {
        // Generate the embed code
        const embedCode = generateEmbedCode(botId);
        
        // Method 1: Modern Clipboard API (requires HTTPS)
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(embedCode);
                showCopySuccess();
                return;
            } catch (err) {
                console.log('Clipboard API failed, trying fallback method');
            }
        }
        
        // Method 2: Fallback using execCommand (deprecated but widely supported)
        if (copyToClipboardFallback(embedCode)) {
            showCopySuccess();
            return;
        }
        
        // Method 3: Show modal with code if copying fails
        showEmbedCodeModal(embedCode);
        
    } catch (error) {
        console.error('Copy embed code error:', error);
        alert('Failed to copy embed code. Please try again.');
    }
}

// Fallback copy method using deprecated execCommand
function copyToClipboardFallback(text) {
    try {
        // Create a temporary textarea element
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        
        // Select and copy the text
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        
        // Clean up
        document.body.removeChild(textArea);
        
        return successful;
    } catch (err) {
        console.error('Fallback copy method failed:', err);
        return false;
    }
}

// Generate embed code for a chatbot
function generateEmbedCode(botId) {
    const baseUrl = window.location.origin;
    return `<script>
(function() {
    var script = document.createElement('script');
    script.src = '${baseUrl}/embed/chatbot.js';
    script.setAttribute('data-chatbot-id', '${botId}');
    script.async = true;
    document.head.appendChild(script);
})();
</script>`;
}

// Show embed code in a modal/popup
function showEmbedCode(botId) {
    const embedCode = generateEmbedCode(botId);
    showEmbedCodeModal(embedCode);
}

// Create and show modal with embed code
function showEmbedCodeModal(embedCode) {
    // Remove existing modal if present
    const existingModal = document.getElementById('embedModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal
    const modal = document.createElement('div');
    modal.id = 'embedModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 8px;
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
    `;
    
    modalContent.innerHTML = `
        <h3>Embed Code</h3>
        <p>Copy this code and paste it into your website's HTML:</p>
        <textarea readonly style="width: 100%; height: 150px; font-family: monospace; font-size: 12px; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">${embedCode}</textarea>
        <div style="margin-top: 15px; text-align: right;">
            <button onclick="selectEmbedText()" style="margin-right: 10px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Select All</button>
            <button onclick="closeEmbedModal()" style="padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Close</button>
        </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeEmbedModal();
        }
    });
}

// Select all text in the embed code textarea
function selectEmbedText() {
    const textarea = document.querySelector('#embedModal textarea');
    if (textarea) {
        textarea.select();
        textarea.setSelectionRange(0, 99999); // For mobile devices
        
        // Try to copy again
        try {
            document.execCommand('copy');
            showCopySuccess();
        } catch (err) {
            console.log('Copy after select failed');
        }
    }
}

// Close the embed code modal
function closeEmbedModal() {
    const modal = document.getElementById('embedModal');
    if (modal) {
        modal.remove();
    }
}

// Show success message
function showCopySuccess() {
    // Remove existing success message
    const existingMsg = document.getElementById('copySuccess');
    if (existingMsg) {
        existingMsg.remove();
    }
    
    // Create success message
    const successMsg = document.createElement('div');
    successMsg.id = 'copySuccess';
    successMsg.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        z-index: 1001;
        font-weight: bold;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    successMsg.textContent = 'Embed code copied to clipboard!';
    
    document.body.appendChild(successMsg);
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (document.getElementById('copySuccess')) {
            successMsg.remove();
        }
    }, 3000);
}




function setupDocumentUpload() {
    // PDF Upload Form Handler
    document.getElementById('pdfUploadForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await uploadPDF(e.target);
    });

    // Link Add Form Handler
    document.getElementById('linkAddForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await addLink(e.target);
    });
}

async function uploadPDF(form) {
    const formData = new FormData(form);
    formData.append('chatbotId', currentChatbotId);

    showUploadStatus('Uploading PDF...', 'processing');

    try {
        const response = await fetch('/api/document/upload-pdf', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
        });

        const data = await response.json();
        if (data.success) {
            showUploadStatus('PDF uploaded successfully! Processing in background...', 'success');
            form.reset();
            loadChatbots(); // Refresh the chatbot list
        } else {
            showUploadStatus(`Error: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('PDF upload error:', error);
        showUploadStatus('Failed to upload PDF', 'error');
    }
}

async function addLink(form) {
    const formData = new FormData(form);
    const url = formData.get('url');

    showUploadStatus('Adding link...', 'processing');

    try {
        const response = await fetch('/api/document/add-link', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                chatbotId: currentChatbotId,
                url: url
            })
        });

        const data = await response.json();
        if (data.success) {
            showUploadStatus('Link added successfully! Processing in background...', 'success');
            form.reset();
            loadChatbots(); // Refresh the chatbot list
        } else {
            showUploadStatus(`Error: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Add link error:', error);
        showUploadStatus('Failed to add link', 'error');
    }
}

function showUploadStatus(message, type) {
    const statusDiv = document.getElementById('uploadStatus');
    statusDiv.textContent = message;
    statusDiv.className = type;
    statusDiv.style.display = 'block';

    // Hide after 5 seconds for success/error messages
    if (type !== 'processing') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
}


function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    window.location.href = 'views/auth/login.html';
}