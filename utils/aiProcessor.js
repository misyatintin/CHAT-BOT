const axios = require('axios');
const { executeQuery } = require('../config/database');

class AIProcessor {
    constructor() {
        this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
        this.model = process.env.OLLAMA_MODEL || 'llama3:8b';
    }

    async processDocument(content) {
        try {
            // Check if model exists before processing
            await this.ensureModelExists();
            
            const prompt = `Analyze and summarize this content for chatbot training. Extract key information, main topics, and important details that would be useful for answering user questions:

Content: ${content}

Please provide a comprehensive summary that captures the essential information:`;
            
            const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
                model: this.model,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.7,
                    max_tokens: 1000
                }
            });

            return response.data.response;
        } catch (error) {
            console.error('AI processing error:', error);
            throw new Error('Failed to process document with AI');
        }
    }

    async generateResponse(context, userMessage, chatbotId) {
        try {
            // Check if model exists before generating response
            await this.ensureModelExists();
            
            // Get Q&A entries for this chatbot
            const qaEntries = await this.getRelevantQA(chatbotId, userMessage);
            
            // Build enhanced context with Q&A knowledge
            let enhancedContext = context;
            
            if (qaEntries.length > 0) {
                const qaContext = qaEntries.map(qa => 
                    `Q: ${qa.question}\nA: ${qa.answer}`
                ).join('\n\n');
                
                enhancedContext = `${context}\n\n--- Custom Q&A Knowledge ---\n${qaContext}`;
            }
            
            const prompt = `You are a helpful AI assistant. Answer the user's question using the provided knowledge base.

Knowledge Base: ${enhancedContext}

User Question: ${userMessage}

Instructions:
- If you find the answer in the knowledge base, provide it directly and clearly
- If the knowledge base doesn't contain the answer, say you don't have that information
- Be helpful and conversational

Answer:`;

            const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
                model: this.model,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.7,
                    max_tokens: 500
                }
            });

            return response.data.response;
        } catch (error) {
            console.error('Response generation error:', error);
            return "I'm sorry, I couldn't process your request at the moment. Please try again later.";
        }
    }

    async getRelevantQA(chatbotId, userMessage) {
        try {
            if (!userMessage || userMessage.trim().length === 0) {
                return [];
            }

            // Extract keywords from user message
            const keywords = this.extractKeywords(userMessage);
            const searchTerms = userMessage.toLowerCase().trim();
            
            if (keywords.length === 0) {
                // If no keywords, get most recent Q&A entries
                const recentQA = await executeQuery(
                    'SELECT question, answer FROM chatbot_qa WHERE chatbot_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 5',
                    [chatbotId]
                );
                console.log(`✅ Found ${recentQA.length} recent Q&A entries (no keywords)`);
                return recentQA;
            }

            // First try: Simple LIKE search for better compatibility
            const likeResults = await executeQuery(`
                SELECT 
                    question, 
                    answer,
                    'like_match' as match_type
                FROM chatbot_qa 
                WHERE chatbot_id = ? AND is_active = 1 
                AND (
                    LOWER(question) LIKE ? OR 
                    LOWER(answer) LIKE ? OR 
                    LOWER(keywords) LIKE ?
                )
                ORDER BY created_at DESC 
                LIMIT 5
            `, [
                chatbotId, 
                `%${searchTerms}%`, 
                `%${searchTerms}%`, 
                `%${searchTerms}%`
            ]);

            // If we have LIKE results, return them
            if (likeResults.length > 0) {
                console.log(`✅ Found ${likeResults.length} Q&A matches using LIKE search`);
                return likeResults;
            }

            // Try keyword-based search
            const keywordResults = await executeQuery(`
                SELECT 
                    question, 
                    answer,
                    'keyword_match' as match_type
                FROM chatbot_qa 
                WHERE chatbot_id = ? AND is_active = 1 
                AND (${keywords.map(() => '(LOWER(question) LIKE ? OR LOWER(answer) LIKE ? OR LOWER(keywords) LIKE ?)').join(' OR ')})
                ORDER BY created_at DESC 
                LIMIT 10
            `, [
                chatbotId,
                ...keywords.flatMap(keyword => [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`])
            ]);

            if (keywordResults.length > 0) {
                console.log(`✅ Found ${keywordResults.length} Q&A matches using keyword search`);
                return keywordResults;
            }

            // Fallback: Try fulltext search with proper error handling (if fulltext index exists)
            try {
                // Clean search terms for fulltext search
                const cleanKeywords = keywords.filter(keyword => keyword.length > 2);
                
                if (cleanKeywords.length > 0) {
                    // Create boolean search string
                    const booleanSearch = cleanKeywords.map(word => `+${word}*`).join(' ');
                    
                    const fulltextResults = await executeQuery(`
                        SELECT 
                            question, 
                            answer,
                            'fulltext_match' as match_type,
                            MATCH(question, answer, keywords) AGAINST(? IN BOOLEAN MODE) as relevance_score
                        FROM chatbot_qa 
                        WHERE chatbot_id = ? AND is_active = 1 
                        AND MATCH(question, answer, keywords) AGAINST(? IN BOOLEAN MODE)
                        ORDER BY relevance_score DESC, created_at DESC 
                        LIMIT 5
                    `, [booleanSearch, chatbotId, booleanSearch]);

                    console.log(`✅ Found ${fulltextResults.length} Q&A matches using fulltext search`);
                    return fulltextResults;
                }
            } catch (fulltextError) {
                console.warn('Fulltext search failed, using fallback:', fulltextError.message);
            }

            // If no matches found, return empty array
            console.log('No Q&A matches found');
            return [];
            
        } catch (error) {
            console.error('Error fetching Q&A entries:', error);
            // Return empty array if search fails
            return [];
        }
    }

    extractKeywords(text) {
        // Remove common words and extract meaningful keywords
        const commonWords = ['what', 'how', 'when', 'where', 'why', 'who', 'which', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 'can', 'could', 'would', 'should', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'by', 'with', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'this', 'that', 'these', 'those'];
        
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ') // Remove punctuation
            .split(/\s+/)
            .filter(word => word.length > 2 && !commonWords.includes(word))
            .slice(0, 10); // Limit to 10 keywords
    }

    async ensureModelExists() {
        try {
            const response = await axios.get(`${this.ollamaUrl}/api/tags`);
            const availableModels = response.data.models || [];
            const modelExists = availableModels.some(model => model.name === this.model);
            
            if (!modelExists) {
                console.log(`Model ${this.model} not found. Available models:`, availableModels.map(m => m.name));
                
                // Try to pull the model if it doesn't exist
                console.log(`Attempting to pull model: ${this.model}`);
                await axios.post(`${this.ollamaUrl}/api/pull`, {
                    name: this.model
                });
                console.log(`Model ${this.model} pulled successfully`);
            }
        } catch (error) {
            console.error('Error checking/pulling model:', error);
            // If the default model doesn't work, try common alternatives
            const fallbackModels = ['llama3:8b', 'llama2:7b', 'mistral:7b', 'codellama:7b'];
            
            for (const fallback of fallbackModels) {
                try {
                    const response = await axios.get(`${this.ollamaUrl}/api/tags`);
                    const availableModels = response.data.models || [];
                    const modelExists = availableModels.some(model => model.name === fallback);
                    
                    if (modelExists) {
                        console.log(`Using fallback model: ${fallback}`);
                        this.model = fallback;
                        return;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            throw new Error(`No compatible models found. Please install a model using: ollama pull llama3:8b`);
        }
    }

    async testConnection() {
        try {
            const response = await axios.get(`${this.ollamaUrl}/api/tags`);
            console.log('Available models:', response.data.models?.map(m => m.name) || []);
            return response.data;
        } catch (error) {
            console.error('Ollama connection error:', error);
            throw new Error('Could not connect to Ollama server');
        }
    }
}

module.exports = AIProcessor;