const multer = require('multer');

// Configure RAM memory storage instead of saving files to local disk paths
const storage = multer.memoryStorage();

// Strict filter to guarantee that only image files are accepted by the server
const imageFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file structure. Only image attachments are supported.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: imageFilter,
    limits: {
        fileSize: 20 * 1024 * 1024, // 20MB max payload constraint per individual file
    }
});

module.exports = upload;