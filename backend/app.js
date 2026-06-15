const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('./middleware/mongoSanitize');
const multer = require('multer');

const requireDatabase = require('./middleware/requireDatabase');
const authenticate = require('./middleware/authenticate');
const requireRole = require('./middleware/requireRole');
const { isPdfBuffer } = require('./utils/pdfBuffer');

const granteeRoutes = require('./routes/granteeRoutes');
const authRoutes = require('./routes/authRoutes');
const archiveRoutes = require('./routes/archiveRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const claimHistoryRoutes = require('./routes/claimHistoryRoutes');
const landingSettingsRoutes = require('./routes/landingSettingsRoutes');
const landingBatchRoutes = require('./routes/landingBatchRoutes');
const programRoutes = require('./routes/programRoutes');
const auditLogRoutes = require('./routes/auditLogRoutes');
const publicRoutes = require('./routes/publicRoutes');

const app = express();
const pdfUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 32 * 1024 * 1024 },
});

const frontendOrigin = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const extraOrigins = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
const allowedOrigins = new Set([frontendOrigin, ...extraOrigins]);

function isAllowedOrigin(origin) {
    if (!origin || allowedOrigins.has(origin)) {
        return true;
    }
    if (process.env.NODE_ENV !== 'production') {
        try {
            const { hostname, protocol } = new URL(origin);
            if (
                (hostname === 'localhost' || hostname === '127.0.0.1') &&
                (protocol === 'http:' || protocol === 'https:')
            ) {
                return true;
            }
        } catch {
            // Ignore malformed origin values.
        }
    }
    return false;
}

app.set('trust proxy', 1);
app.set('query parser', 'simple');
app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
}));
app.use(mongoSanitize());
app.use(
    cors({
        origin(origin, callback) {
            if (isAllowedOrigin(origin)) {
                return callback(null, true);
            }
            return callback(new Error('Not allowed by CORS'));
        },
    }),
);

function buildRateLimiter({ windowMs, max, message }) {
    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        message: { message },
    });
}

const authLimiter = buildRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: 'Too many authentication attempts. Please try again later.',
});

const otpRequestLimiter = buildRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many verification code requests. Please try again later.',
});

const otpVerifyLimiter = buildRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many password change attempts. Please try again later.',
});

const publicLimiter = buildRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 120,
    message: 'Too many requests. Please try again later.',
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use('/api/public', publicLimiter, requireDatabase, publicRoutes);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth/change-password/request-otp', otpRequestLimiter);
app.use('/api/auth/change-password', otpVerifyLimiter);
app.use('/api/auth', requireDatabase, authRoutes);
app.use('/api/grantees', requireDatabase, granteeRoutes);
app.use('/api/archive', requireDatabase, archiveRoutes);
app.use('/api/announcements', requireDatabase, announcementRoutes);
app.use('/api/notifications', requireDatabase, notificationRoutes);
app.use('/api/claim-history', requireDatabase, claimHistoryRoutes);
app.use('/api/landing-settings', requireDatabase, landingSettingsRoutes);
app.use('/api/landing-batches', requireDatabase, landingBatchRoutes);
app.use('/api/programs', requireDatabase, programRoutes);
app.use('/api/audit-logs', requireDatabase, auditLogRoutes);

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

function getPdfConverterInternalHeaders() {
    const token = String(process.env.PDF_CONVERTER_INTERNAL_TOKEN || '').trim();
    if (!token) return {};
    return { 'X-Internal-Token': token };
}

app.post(
    '/api/pdf-converter/upload',
    authenticate,
    requireRole('osgfa'),
    pdfUpload.single('pdf'),
    async (req, res) => {
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

    if (!isPdfBuffer(req.file.buffer)) {
        return res.status(400).json({ error: 'Only valid PDF files are accepted.' });
    }

    try {
        const form = new FormData();
        const fileBlob = new Blob([req.file.buffer], { type: 'application/pdf' });
        form.append('pdf', fileBlob, req.file.originalname || 'upload.pdf');

        const upstreamRes = await fetch(upstreamUploadUrl, {
            method: 'POST',
            body: form,
            headers: getPdfConverterInternalHeaders(),
        });

        const contentType = upstreamRes.headers.get('content-type') || 'application/octet-stream';
        const bodyBuffer = Buffer.from(await upstreamRes.arrayBuffer());

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', 'attachment; filename="converted_grantees.xlsx"');
        return res.status(upstreamRes.status).send(bodyBuffer);
    } catch (error) {
        return res.status(502).json({
            error: 'Failed to reach PDF converter service.',
            hint: 'Check PDF converter URL env vars and verify the Python converter is online.',
        });
    }
    },
);

app.get('/api/health', (req, res) => {
    res.json({ ok: true });
});

app.get('/', (req, res) => {
    res.send('SRMS Backend is Running!');
});

app.use((err, req, res, next) => {
    if (err?.message === 'Not allowed by CORS') {
        return res.status(403).json({ message: 'Origin not allowed.' });
    }
    console.error('Unhandled error:', err);
    return res.status(500).json({ message: 'Internal server error.' });
});

module.exports = app;
