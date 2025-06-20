const fs = require('fs');
const pdf = require('pdf-parse');

class PDFProcessor {
    async extractText(filePath) {
        try {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdf(dataBuffer);
            
            // Clean up the extracted text
            let cleanText = data.text
                .replace(/\s+/g, ' ') // Replace multiple spaces with single space
                .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newline
                .trim();

            return cleanText;
        } catch (error) {
            console.error('PDF processing error:', error);
            throw new Error('Failed to extract text from PDF');
        }
    }

    async extractMetadata(filePath) {
        try {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdf(dataBuffer);
            
            return {
                pages: data.numpages,
                info: data.info,
                metadata: data.metadata,
                version: data.version
            };
        } catch (error) {
            console.error('PDF metadata extraction error:', error);
            return null;
        }
    }

    validatePDF(filePath) {
        try {
            const stats = fs.statSync(filePath);
            const fileSizeInMB = stats.size / (1024 * 1024);
            
            // Check file size (limit to 10MB)
            if (fileSizeInMB > 10) {
                throw new Error('PDF file is too large. Maximum size allowed is 10MB.');
            }

            // Check file extension
            if (!filePath.toLowerCase().endsWith('.pdf')) {
                throw new Error('Invalid file type. Only PDF files are allowed.');
            }

            return true;
        } catch (error) {
            throw error;
        }
    }
}

module.exports = PDFProcessor;