const multer = require('multer');

const MAX_ANNOUNCEMENT_IMAGE_MB = 20;
const MAX_ANNOUNCEMENT_IMAGE_BYTES = MAX_ANNOUNCEMENT_IMAGE_MB * 1024 * 1024;
const MAX_ANNOUNCEMENT_IMAGE_COUNT = 8;

const storage = multer.memoryStorage();

const imageFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file structure. Only image attachments are supported.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter: imageFilter,
    limits: {
        fileSize: MAX_ANNOUNCEMENT_IMAGE_BYTES,
        files: MAX_ANNOUNCEMENT_IMAGE_COUNT,
    },
});

function runAnnouncementImageUpload(req, res, next) {
    upload.array('images', MAX_ANNOUNCEMENT_IMAGE_COUNT)(req, res, (err) => {
        if (!err) return next();

        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({
                    message: `Each image must be ${MAX_ANNOUNCEMENT_IMAGE_MB} MB or smaller.`,
                });
            }
            if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
                return res.status(400).json({
                    message: `A maximum of ${MAX_ANNOUNCEMENT_IMAGE_COUNT} images are allowed per announcement.`,
                });
            }
            return res.status(400).json({ message: err.message || 'Image upload failed.' });
        }

        return res.status(400).json({
            message: err.message || 'Image upload failed.',
        });
    });
}

module.exports = {
    runAnnouncementImageUpload,
    MAX_ANNOUNCEMENT_IMAGE_MB,
    MAX_ANNOUNCEMENT_IMAGE_COUNT,
};
