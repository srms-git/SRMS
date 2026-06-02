const express = require('express');
const cors = require('cors');
const multer = require('multer');

const requireDatabase = require('./middleware/requireDatabase');

const granteeRoutes = require('./routes/granteeRoutes');
const authRoutes = require('./routes/authRoutes');
const archiveRoutes = require('./routes/archiveRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const claimHistoryRoutes = require('./routes/claimHistoryRoutes');
const landingSettingsRoutes = require('./routes/landingSettingsRoutes');
const landingBatchRoutes = require('./routes/landingBatchRoutes');

const app = express();
const pdfUpload = multer({ storage: multer.memoryStorage() });

const frontendOrigin = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (origin === frontendOrigin) return callback(null, true);
            return callback(null, true);
        },
    }),
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use('/api/auth', requireDatabase, authRoutes);
app.use('/api/grantees', requireDatabase, granteeRoutes);
app.use('/api/archive', requireDatabase, archiveRoutes);
app.use('/api/announcements', requireDatabase, announcementRoutes);
app.use('/api/notifications', requireDatabase, notificationRoutes);
app.use('/api/claim-history', requireDatabase, claimHistoryRoutes);
app.use('/api/landing-settings', requireDatabase, landingSettingsRoutes);
app.use('/api/landing-batches', requireDatabase, landingBatchRoutes);

function getPdfConverterUploadUrl() {
    const candidates = [
        process.env.PDF_CONVERTER_UPLOAD_URL,
        process.env.PDF_CONVERTER_URL,
        process.env.VITE_PDF_CONVERTER_URL,
        process.env.NEXT_PUBLIC_PDF_CONVERTER_URL,
    ];

    const raw = candidates.find((value) => String(value || '').trim()) || '';
    const normalized = String(raw).trim().replace(/\/+$/, '');
    if (!normalized) return null;
    if (/\/upload$/i.test(normalized)) return normalized;
    return `${normalized}/upload`;
}

app.post('/api/pdf-converter/upload', pdfUpload.single('pdf'), async (req, res) => {
    const upstreamUploadUrl = getPdfConverterUploadUrl();

    if (!upstreamUploadUrl) {
        return res.status(503).json({
            error: 'PDF converter service URL is not configured.',
            hint: 'Set one of: PDF_CONVERTER_UPLOAD_URL, PDF_CONVERTER_URL, VITE_PDF_CONVERTER_URL, or NEXT_PUBLIC_PDF_CONVERTER_URL.',
        });
    }

    if (!req.file) {
        return res.status(400).json({ error: 'Missing form field "pdf" (PDF upload).' });
    }

    try {
        const form = new FormData();
        const fileBlob = new Blob([req.file.buffer], { type: req.file.mimetype || 'application/pdf' });
        form.append('pdf', fileBlob, req.file.originalname || 'upload.pdf');

        const upstreamRes = await fetch(upstreamUploadUrl, {
            method: 'POST',
            body: form,
        });

        const contentType = upstreamRes.headers.get('content-type') || 'application/octet-stream';
        const contentDisposition = upstreamRes.headers.get('content-disposition');
        const bodyBuffer = Buffer.from(await upstreamRes.arrayBuffer());

        if (contentDisposition) res.setHeader('Content-Disposition', contentDisposition);
        res.setHeader('Content-Type', contentType);
        return res.status(upstreamRes.status).send(bodyBuffer);
    } catch (error) {
        return res.status(502).json({
            error: 'Failed to reach PDF converter service.',
            hint: 'Check PDF converter URL env vars and verify the Python converter is online.',
            details: error?.message || 'Unknown upstream error',
        });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ ok: true });
});

app.get('/', (req, res) => {
    res.send('SRMS Backend is Running!');
});

module.exports = app;

