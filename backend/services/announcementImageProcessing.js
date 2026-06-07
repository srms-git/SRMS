const sharp = require('sharp');

sharp.cache(false);
sharp.concurrency(1);

const MAX_IMAGE_WIDTH = 1200;
const MONGODB_SAFE_IMAGE_BYTES = 14 * 1024 * 1024;

/**
 * Compress one image buffer (sequential callers avoid memory spikes on multi-upload).
 */
async function compressImage(fileBuffer) {
    return sharp(fileBuffer, { failOn: 'none', limitInputPixels: 40_000_000 })
        .rotate()
        .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: 72, progressive: true, mozjpeg: true })
        .toBuffer();
}

async function processUploadedAnnouncementImages(files = []) {
    const images = [];

    for (const file of files) {
        try {
            const compressedBuffer = await compressImage(file.buffer);
            images.push({
                data: compressedBuffer,
                contentType: 'image/jpeg',
                fileName: file.originalname || 'attachment.jpg',
            });
        } catch (error) {
            console.error('Image compression failed:', error);
            throw new Error(
                `Failed to process "${file.originalname || 'image'}". Try a different file or fewer images at once.`,
            );
        }
    }

    const totalBytes = images.reduce((sum, image) => sum + (image.data?.length || 0), 0);
    if (totalBytes > MONGODB_SAFE_IMAGE_BYTES) {
        throw new Error(
            'Images are too large to store together. Remove some pictures or use smaller files.',
        );
    }

    return images;
}

module.exports = {
    compressImage,
    processUploadedAnnouncementImages,
};
