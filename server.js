require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = process.env.PORT || 3000;

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
        const cleanName = path.parse(file.originalname).name.replace(/[^a-zA-Z0-9_-]/g, '_');
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                public_id: `${cleanName}-${Date.now()}`,
                // Use 'raw' for PDFs so they are served under /raw/upload/ with correct
                // content-type headers; 'auto' was classifying PDFs as images (/image/upload/)
                // which prevents the browser PDF viewer from loading them.
                resource_type: file.mimetype === 'application/pdf' ? 'raw' : 'auto'
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
        res.json({ success: true, data });
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
            pinned: false
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
        res.json({ success: true, link: newLink, resources: updated.resources });
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
            updatedAt: new Date().toISOString().split('T')[0]
        };

        if (!db.campusDocs) db.campusDocs = [];
        db.campusDocs.unshift(newDoc);

        const updated = await writeDB(db);
        res.json({ success: true, doc: newDoc, campusDocs: updated.campusDocs });
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
            date: new Date().toISOString().split('T')[0]
        };

        if (!db.announcements) db.announcements = [];
        db.announcements.unshift(newAnn);

        const updated = await writeDB(db);
        res.json({ success: true, announcement: newAnn, announcements: updated.announcements });
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

// Fallback Route for Single Page Application
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Export app for Vercel
module.exports = app;

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

