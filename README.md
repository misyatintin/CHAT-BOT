Project Structure (MVC)
ai-chatbot-system/
├── controllers/
│   ├── authController.js
│   ├── chatbotController.js
│   ├── documentController.js
│   └── embedController.js
├── models/
│   ├── User.js
│   ├── Chatbot.js
│   ├── Document.js
│   └── Conversation.js
├── views/
│   ├── auth/
│   │   ├── login.html
│   │   └── register.html
│   ├── dashboard/
│   │   ├── index.html
│   │   └── create-bot.html
│   └── embed/
│   │   └── chatbot-widget.html
├── routes/
│   ├── auth.js
│   ├── chatbot.js
          qa.js
│   ├── document.js
│   └── embed.js
├── middleware/
│   ├── auth.js
│   └── upload.js
├── utils/
│   ├── aiProcessor.js
│   ├── pdfProcessor.js
│   └── linkScraper.js
├── public/
│   ├── css/auth.css and dashboard.css

│   ├── js/chatbot-widget.js and dashboard.js
│   └── uploads/
├── config/
│   └── database.js
├── app.js
└── package.json
Database Schema
Users Table
sqlCREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
Chatbots Table
sqlCREATE TABLE chatbots (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    embed_code TEXT,
    website_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
Documents Table
sqlCREATE TABLE documents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    chatbot_id INT,
    type ENUM('pdf', 'link') NOT NULL,
    source_url VARCHAR(500),
    file_path VARCHAR(500),
    processed_content LONGTEXT,
    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chatbot_id) REFERENCES chatbots(id)
);
Conversations Table
sqlCREATE TABLE conversations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    chatbot_id INT,
    user_message TEXT NOT NULL,
    bot_response TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chatbot_id) REFERENCES chatbots(id)
);


ALTER TABLE conversations 
ADD COLUMN session_id VARCHAR(255) AFTER chatbot_id,
ADD COLUMN response_time INT DEFAULT 0 AFTER bot_response;

-- Add the indexes as well
CREATE INDEX idx_chatbot_session ON conversations(chatbot_id, session_id);
CREATE INDEX idx_created_at ON conversations(created_at);


-- Add missing columns to documents table
ALTER TABLE documents 
ADD COLUMN   error_message TEXT AFTER status,
ADD COLUMN  original_name VARCHAR(500) AFTER file_path,
ADD COLUMN metadata JSON AFTER processed_content,
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;


-- Add indexes for better performance
CREATE INDEX  idx_documents_chatbot_id ON documents(chatbot_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX  idx_documents_type ON documents(type);
CREATE INDEX  idx_documents_created_at ON documents(created_at);






-- Create Q&A table for storing custom questions and answers
CREATE TABLE chatbot_qa (
    id INT PRIMARY KEY AUTO_INCREMENT,
    chatbot_id INT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    keywords TEXT, -- For better matching and search
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (chatbot_id) REFERENCES chatbots(id) ON DELETE CASCADE
);

-- Add indexes for better performance
CREATE INDEX idx_qa_chatbot_id ON chatbot_qa(chatbot_id);
CREATE INDEX idx_qa_active ON chatbot_qa(is_active);
CREATE INDEX idx_qa_created_at ON chatbot_qa(created_at);
CREATE FULLTEXT INDEX idx_qa_question_answer ON chatbot_qa(question, answer, keywords);




