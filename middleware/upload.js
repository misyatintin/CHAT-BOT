const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = 'public/uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Create unique filename with timestamp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        const fileName = file.fieldname + '-' + uniqueSuffix + fileExtension;
        cb(null, fileName);
    }
});

// File filter function
const fileFilter = (req, file, cb) => {
    // Check file type
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Only PDF files are allowed'), false);
    }
};

// Configure multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 1 // Only allow 1 file at a time
    }
});

// Error handling middleware for multer
const handleUploadError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        } else if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ error: 'Too many files. Only 1 file allowed.' });
        } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ error: 'Unexpected field name for file upload.' });
        }
        return res.status(400).json({ error: 'File upload error: ' + error.message });
    } else if (error) {
        return res.status(400).json({ error: error.message });
    }
    next();
};

// Clean up uploaded files (useful for cleanup on error)
const cleanupFile = (filePath) => {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log('Cleaned up file:', filePath);
        }
    } catch (error) {
        console.error('Error cleaning up file:', error);
    }
};

// Middleware to clean up old uploaded files (optional)
const cleanupOldFiles = (maxAgeInDays = 30) => {
    return (req, res, next) => {
        const maxAge = maxAgeInDays * 24 * 60 * 60 * 1000; // Convert to milliseconds
        const now = Date.now();
        
        try {
            const files = fs.readdirSync(uploadDir);
            
            files.forEach(file => {
                const filePath = path.join(uploadDir, file);
                const stats = fs.statSync(filePath);
                
                if (now - stats.mtime.getTime() > maxAge) {
                    fs.unlinkSync(filePath);
                    console.log('Cleaned up old file:', file);
                }
            });
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
        
        next();
    };
};

module.exports = {
    upload,
    handleUploadError,
    cleanupFile,
    cleanupOldFiles
};