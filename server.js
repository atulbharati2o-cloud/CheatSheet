require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = process.env.PORT || 3000;

// ponytail: hardcoded admin password as requested; env override wins if present.
// Anyone with repo access can read this — rotate via ADMIN_PASSWORD env, not a code edit, in real deployments.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'campus-vault-admin-2026';
// Header only — no ?pass= query fallback, which would leak the password into logs and browser history.
const isAdmin = req => req.get('x-admin-pass') === ADMIN_PASSWORD;

// Public view = everything except items still awaiting admin approval
function publicView(data) {
    return {
        resources: (data.resources || [])
            .map(g => ({ ...g, links: (g.links || []).filter(l => !l.pending) }))
            .filter(g => g.links && g.links.length > 0),
        campusDocs: (data.campusDocs || []).filter(d => !d.pending),
        announcements: (data.announcements || []).filter(a => !a.pending)
    };
}

// Verify MongoDB Connection String
if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set in .env');
}

// Check and configure Cloudinary
const isCloudinaryConfigured = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name_here' &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
    console.log(`✅ Cloudinary Storage: Configured for cloud "${process.env.CLOUDINARY_CLOUD_NAME}"`);
} else {
    console.warn('⚠️ Cloudinary: Cloud name not set in .env. (Set CLOUDINARY_CLOUD_NAME to enable uploads)');
}

// Multer memory storage (Streams directly to Cloudinary, no disk writes)
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 35 * 1024 * 1024 } // 35MB max file size
});

// Stream upload directly to Cloudinary
function uploadToCloudinary(file, folder = 'academic_hub') {
    return new Promise((resolve, reject) => {
        if (!isCloudinaryConfigured) {
            return reject(new Error('Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME in .env'));
        }
        const originalExt = path.extname(file.originalname).toLowerCase();
        const cleanName = path.parse(file.originalname).name.replace(/[^a-zA-Z0-9_-]/g, '_');
        
        // Cloudinary blocks PDF delivery as 'image' by default for security.
        // We must upload them as 'raw' to allow public viewing.
        // Other non-image/video files should also be 'raw'.
        const isImageOrVideo = /^\.(jpe?g|png|gif|webp|mp4|webm|mov)$/i.test(originalExt);
        const resourceType = isImageOrVideo ? 'auto' : 'raw';
        
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                // For 'raw' files, Cloudinary does NOT auto-append the extension,
                // so we must include it in the public_id. For 'auto' (images), it does.
                public_id: resourceType === 'raw' ? `${cleanName}-${Date.now()}${originalExt}` : `${cleanName}-${Date.now()}`,
                resource_type: resourceType,
                // Force public delivery at upload time
                access_mode: 'public'
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result.secure_url);
            }
        );
        uploadStream.end(file.buffer);
    });
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Schema for Academic Hub
const HubDataSchema = new mongoose.Schema({
    hubId: { type: String, default: 'default_hub', unique: true },
    resources: { type: Array, default: [] },
    campusDocs: { type: Array, default: [] },
    announcements: { type: Array, default: [] }
}, { timestamps: true });

const HubDataModel = mongoose.model('HubData', HubDataSchema);

let dbConnectionPromise = null;

// Ensure database connection with automatic reconnection / wait
async function ensureDbConnection() {
    if (mongoose.connection.readyState === 1) return;

    if (mongoose.connection.readyState === 2 && dbConnectionPromise) {
        await dbConnectionPromise;
        return;
    }

    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is not configured in .env');
    }

    dbConnectionPromise = mongoose.connect(process.env.MONGODB_URI)
        .catch(err => {
            dbConnectionPromise = null; // Clear so next call can retry
            throw err;
        });
    await dbConnectionPromise;
}

// Connect immediately on startup
ensureDbConnection()
    .then(() => console.log('✅ Persistent Database: Connected to MongoDB Atlas successfully!'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err.message));

// Pure MongoDB Helper: Read State
async function readDB() {
    await ensureDbConnection();
    let doc = await HubDataModel.findOne({ hubId: 'default_hub' });
    if (!doc) {
        doc = await HubDataModel.create({
            hubId: 'default_hub',
            resources: [],
            campusDocs: [],
            announcements: []
        });
    }
    return {
        resources: doc.resources || [],
        campusDocs: doc.campusDocs || [],
        announcements: doc.announcements || []
    };
}

// Pure MongoDB Helper: Write State
async function writeDB(data) {
    await ensureDbConnection();
    // Use explicit $set so Mongoose always replaces the mixed Array fields.
    // Without $set, updates to untyped Array schema fields can be silently ignored.
    const updated = await HubDataModel.findOneAndUpdate(
        { hubId: 'default_hub' },
        {
            $set: {
                resources: data.resources || [],
                campusDocs: data.campusDocs || [],
                announcements: data.announcements || []
            }
        },
        { upsert: true, new: true, strict: false }
    );
    return {
        resources: updated.resources || [],
        campusDocs: updated.campusDocs || [],
        announcements: updated.announcements || []
    };
}

// Routes

// 0. Live Status Route
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        mongoConnected: mongoose.connection.readyState === 1,
        cloudinaryConfigured: isCloudinaryConfigured,
        cloudName: isCloudinaryConfigured ? process.env.CLOUDINARY_CLOUD_NAME : null
    });
});

// 1. Get entire database state directly from MongoDB
app.get('/api/data', async (req, res) => {
    try {
        const data = await readDB();
        res.json({ success: true, data: publicView(data) });
    } catch (err) {
        console.error('GET /api/data error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 2. Direct file upload to Cloudinary
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file provided' });
        }
        const fileUrl = await uploadToCloudinary(req.file, 'academic_hub/uploads');
        res.json({
            success: true,
            url: fileUrl,
            originalname: req.file.originalname,
            size: req.file.size
        });
    } catch (err) {
        console.error('POST /api/upload error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 3. Add Resource Link / File to MongoDB
app.post('/api/resources', upload.single('file'), async (req, res) => {
    try {
        let { category, title, label, href, note } = req.body;

        if (req.file) {
            href = await uploadToCloudinary(req.file, 'academic_hub/resources');
            if (!label) {
                label = req.file.originalname;
            }
        }

        if (!title || !label || !href) {
            return res.status(400).json({ success: false, message: 'Title, label, and a valid URL or file upload are required.' });
        }

        const db = await readDB();
        let group = db.resources.find(g => g.title && g.title.toLowerCase() === title.toLowerCase());

        const newLink = {
            id: 'lnk-' + Date.now(),
            label,
            href,
            note: note || '',
            pinned: false,
            pending: true
        };

        if (group) {
            group.links.push(newLink);
        } else {
            db.resources.push({
                category: category || 'Core Subject',
                title,
                links: [newLink]
            });
        }

        const updated = await writeDB(db);
        res.json({ success: true, link: newLink, resources: publicView(updated).resources });
    } catch (err) {
        console.error('POST /api/resources error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4. Toggle Pin status directly in MongoDB
app.patch('/api/resources/:id/pin', async (req, res) => {
    try {
        const { id } = req.params;
        const db = await readDB();
        let found = false;
        let pinnedState = false;

        db.resources.forEach(group => {
            (group.links || []).forEach(link => {
                if (link.id === id) {
                    link.pinned = !link.pinned;
                    pinnedState = link.pinned;
                    found = true;
                }
            });
        });

        if (!found) {
            return res.status(404).json({ success: false, message: 'Resource link not found' });
        }

        const updated = await writeDB(db);
        res.json({ success: true, id, pinned: pinnedState, resources: updated.resources });
    } catch (err) {
        console.error('PATCH /api/resources/:id/pin error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 5. Delete Resource Link directly from MongoDB
app.delete('/api/resources/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = await readDB();

        db.resources.forEach(group => {
            group.links = (group.links || []).filter(l => l.id !== id);
        });

        db.resources = db.resources.filter(g => g.links && g.links.length > 0);

        const updated = await writeDB(db);
        res.json({ success: true, resources: updated.resources });
    } catch (err) {
        console.error('DELETE /api/resources/:id error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 6. Add Campus Document (Timetable, Mess Menu, Exam Schedule, Holiday) to MongoDB + Cloudinary
app.post('/api/campus-docs', upload.single('file'), async (req, res) => {
    try {
        const { type, title, note, url } = req.body;
        let fileUrl = url || '';

        if (req.file) {
            fileUrl = await uploadToCloudinary(req.file, 'academic_hub/campus_docs');
        }

        if (!type || !title || !fileUrl) {
            return res.status(400).json({ success: false, message: 'Type, title, and a valid URL or file upload are required.' });
        }

        const db = await readDB();
        const newDoc = {
            id: 'doc-' + Date.now(),
            type,
            title,
            url: fileUrl,
            note: note || '',
            updatedAt: new Date().toISOString().split('T')[0],
            pending: true
        };

        if (!db.campusDocs) db.campusDocs = [];
        db.campusDocs.unshift(newDoc);

        const updated = await writeDB(db);
        res.json({ success: true, doc: newDoc, campusDocs: publicView(updated).campusDocs });
    } catch (err) {
        console.error('POST /api/campus-docs error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 7. Delete Campus Document directly from MongoDB
app.delete('/api/campus-docs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = await readDB();

        if (db.campusDocs) {
            db.campusDocs = db.campusDocs.filter(d => d.id !== id);
        }

        const updated = await writeDB(db);
        res.json({ success: true, campusDocs: updated.campusDocs });
    } catch (err) {
        console.error('DELETE /api/campus-docs/:id error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8. Add Announcement / Special Note to MongoDB
app.post('/api/announcements', async (req, res) => {
    try {
        const { title, content, badge } = req.body;

        if (!title || !content) {
            return res.status(400).json({ success: false, message: 'Title and content are required.' });
        }

        const db = await readDB();
        const newAnn = {
            id: 'ann-' + Date.now(),
            badge: badge || 'General',
            title,
            content,
            date: new Date().toISOString().split('T')[0],
            pending: true
        };

        if (!db.announcements) db.announcements = [];
        db.announcements.unshift(newAnn);

        const updated = await writeDB(db);
        res.json({ success: true, announcement: newAnn, announcements: publicView(updated).announcements });
    } catch (err) {
        console.error('POST /api/announcements error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 9. Delete Announcement directly from MongoDB
app.delete('/api/announcements/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = await readDB();

        if (db.announcements) {
            db.announcements = db.announcements.filter(a => a.id !== id);
        }

        const updated = await writeDB(db);
        res.json({ success: true, announcements: updated.announcements });
    } catch (err) {
        console.error('DELETE /api/announcements/:id error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// PDF Proxy: Fetches the Cloudinary PDF server-side and streams it with
// Content-Disposition: inline so Chrome's native PDF viewer renders it.
// A server-side fetch is used to avoid browser CORS restrictions.
// Files are uploaded with access_mode: 'public', so no signing is needed —
// and signing caused 401s because the Cloudinary SDK added the wrong version
// segment (v1 instead of the real timestamp version), invalidating the signature.
app.get('/api/view-pdf', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send('Missing url parameter');

    // Security: only proxy Cloudinary URLs
    let parsedUrl;
    try {
        parsedUrl = new URL(url);
    } catch {
        return res.status(400).send('Invalid URL');
    }
    if (!parsedUrl.hostname.endsWith('cloudinary.com')) {
        return res.status(400).send('Only Cloudinary URLs are supported');
    }

    try {
        // Direct server-side fetch — CORS does not apply here.
        // Since files are public, no authentication header is required.
        console.log(`[view-pdf] Fetching: ${url}`);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Cloudinary returned ${response.status} for ${url}`);

        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'application/pdf';
        
        res.set({
            'Content-Type': contentType,
            'Content-Disposition': 'inline',
            'Content-Length': buffer.byteLength,
            'Cache-Control': 'public, max-age=3600'
        });
        res.send(Buffer.from(buffer));
    } catch (err) {
        console.error('GET /api/view-pdf error:', err.message);
        res.status(500).send('Failed to load PDF: ' + err.message);
    }
});

// ---- Admin moderation (hardcoded password, see ADMIN_PASSWORD) ----

// List everything awaiting approval
app.get('/api/admin/pending', async (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
    try {
        const db = await readDB();
        const pending = [];
        (db.resources || []).forEach(g => (g.links || []).forEach(l => {
            if (l.pending) pending.push({ kind: 'resource', id: l.id, group: g.title, category: g.category, label: l.label, href: l.href, note: l.note });
        }));
        (db.campusDocs || []).forEach(d => {
            if (d.pending) pending.push({ kind: 'campusDoc', id: d.id, docType: d.type, title: d.title, href: d.url, note: d.note });
        });
        (db.announcements || []).forEach(a => {
            if (a.pending) pending.push({ kind: 'announcement', id: a.id, badge: a.badge, title: a.title, note: a.content });
        });
        res.json({ success: true, pending });
    } catch (err) {
        console.error('GET /api/admin/pending error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Approve (make public) or reject (discard) one pending item
app.post('/api/admin/moderate', async (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { kind, id, action } = req.body || {};
    if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ success: false, message: 'action must be "approve" or "reject"' });
    }
    try {
        const db = await readDB();
        let found = false;

        if (kind === 'resource') {
            db.resources.forEach(g => {
                (g.links || []).forEach(l => { if (l.id === id) { found = true; if (action === 'approve') l.pending = false; } });
                if (action === 'reject') g.links = (g.links || []).filter(l => l.id !== id);
            });
            db.resources = db.resources.filter(g => g.links && g.links.length > 0);
        } else if (kind === 'campusDoc') {
            (db.campusDocs || []).forEach(d => { if (d.id === id) { found = true; if (action === 'approve') d.pending = false; } });
            if (action === 'reject') db.campusDocs = (db.campusDocs || []).filter(d => d.id !== id);
        } else if (kind === 'announcement') {
            (db.announcements || []).forEach(a => { if (a.id === id) { found = true; if (action === 'approve') a.pending = false; } });
            if (action === 'reject') db.announcements = (db.announcements || []).filter(a => a.id !== id);
        } else {
            return res.status(400).json({ success: false, message: 'Unknown kind' });
        }

        if (!found && action === 'approve') {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        await writeDB(db);
        res.json({ success: true });
    } catch (err) {
        console.error('POST /api/admin/moderate error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Fallback Route for Single Page Application
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Export app for Vercel
module.exports = app;
module.exports.publicView = publicView;

// Start Server locally
if (process.env.NODE_ENV !== 'production') {
    const server = app.listen(PORT, () => {
        console.log(`=======================================================`);
        console.log(`🚀 Academic Hub Server running on port ${PORT}`);
        console.log(`   Database: MongoDB Atlas (academic_hub)`);
        console.log(`   Storage: Cloudinary Cloud CDN`);
        console.log(`   Local URL: http://localhost:${PORT}`);
        console.log(`=======================================================`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`ℹ️ Port ${PORT} already in use. Please check running process.`);
            process.exit(0);
        } else {
            console.error('Server error:', err);
        }
    });
}

