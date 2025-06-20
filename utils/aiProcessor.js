const axios = require('axios');

class AIProcessor {
    constructor() {
        this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
        this.model = process.env.OLLAMA_MODEL || 'llama3:8b'; // Changed from llama3.1:8b to llama3:8b
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

    async generateResponse(context, userMessage) {
        try {
            // Check if model exists before generating response
            await this.ensureModelExists();
            
            const prompt = `You are a helpful AI assistant. Based on the provided context, answer the user's question accurately and helpfully.

Context: ${context}

User Question: ${userMessage}

Please provide a helpful and accurate response based on the context. If the context doesn't contain relevant information, politely explain that you don't have enough information to answer the question.

Response:`;

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