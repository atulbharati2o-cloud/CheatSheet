require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) { fs.mkdirSync(uploadDir, { recursive: true }); }
const upload = multer({ dest: uploadDir });
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'database.json');
const TMP_DB_FILE = path.join('/tmp', 'database.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Schema for Academic Hub Data
const HubDataSchema = new mongoose.Schema({
    hubId: { type: String, default: 'default_hub', unique: true },
    resources: { type: Array, default: [] },
    campusDocs: { type: Array, default: [] },
    announcements: { type: Array, default: [] }
}, { timestamps: true });

const HubDataModel = mongoose.model('HubData', HubDataSchema);

let isMongoConnected = false;

// Connect to MongoDB if MONGODB_URI is provided
if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => {
            console.log('✅ Persistent Cloud Database: Connected to MongoDB Atlas successfully!');
            isMongoConnected = true;
        })
        .catch(err => {
            console.error('⚠️ MongoDB connection error, falling back to local file/memory storage:', err.message);
            isMongoConnected = false;
        });
}

let memoryCache = null;

function readLocalJSON() {
    if (memoryCache) {
        return memoryCache;
    }
    try {
        if (fs.existsSync(TMP_DB_FILE)) {
            const raw = fs.readFileSync(TMP_DB_FILE, 'utf8');
            memoryCache = JSON.parse(raw);
            return memoryCache;
        }
        if (fs.existsSync(DB_FILE)) {
            const raw = fs.readFileSync(DB_FILE, 'utf8');
            memoryCache = JSON.parse(raw);
            return memoryCache;
        }
    } catch (err) {
        console.error('Error reading local database file:', err);
    }
    memoryCache = { resources: [], campusDocs: [], announcements: [] };
    return memoryCache;
}

function writeLocalJSON(data) {
    memoryCache = data;
    try {
        const dir = path.dirname(DB_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (err) {
        try {
            const tmpDir = path.dirname(TMP_DB_FILE);
            if (!fs.existsSync(tmpDir)) {
                fs.mkdirSync(tmpDir, { recursive: true });
            }
            fs.writeFileSync(TMP_DB_FILE, JSON.stringify(data, null, 2), 'utf8');
            return true;
        } catch (tmpErr) {
            console.warn('File write fallback failed (read-only filesystem):', tmpErr.message);
        }
        return false;
    }
}

// Read DB helper (MongoDB if connected, otherwise local JSON)
async function readDB() {
    if (isMongoConnected) {
        try {
            let doc = await HubDataModel.findOne({ hubId: 'default_hub' });
            if (!doc) {
                const initial = readLocalJSON();
                doc = await HubDataModel.create({
                    hubId: 'default_hub',
                    resources: initial.resources || [],
                    campusDocs: initial.campusDocs || [],
                    announcements: initial.announcements || []
                });
            }
            return {
                resources: doc.resources || [],
                campusDocs: doc.campusDocs || [],
                announcements: doc.announcements || []
            };
        } catch (err) {
            console.error('Error reading from MongoDB, using local fallback:', err.message);
        }
    }
    return readLocalJSON();
}

// Write DB helper
async function writeDB(data) {
    if (isMongoConnected) {
        try {
            await HubDataModel.findOneAndUpdate(
                { hubId: 'default_hub' },
                {
                    resources: data.resources,
                    campusDocs: data.campusDocs,
                    announcements: data.announcements
                },
                { upsert: true, new: true }
            );
            return true;
        } catch (err) {
            console.error('Error writing to MongoDB:', err.message);
        }
    }
    return writeLocalJSON(data);
}

// Routes
// 1. Get full database state
app.get('/api/data', async (req, res) => {
    const data = await readDB();
    res.json({ success: true, data });
});

// 2. Add or append a resource link
app.post('/api/resources', async (req, res) => {
    const { category, title, label, href, note } = req.body;

    if (!title || !label || !href) {
        return res.status(400).json({ success: false, message: 'Title, label, and href are required.' });
    }

    const db = await readDB();
    let group = db.resources.find(g => g.title.toLowerCase() === title.toLowerCase());

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

    await writeDB(db);
    res.json({ success: true, link: newLink, resources: db.resources });
});

// 3. Toggle pin status on a resource link
app.patch('/api/resources/:id/pin', async (req, res) => {
    const { id } = req.params;
    const db = await readDB();
    let found = false;
    let pinnedState = false;

    db.resources.forEach(group => {
        group.links.forEach(link => {
            if (link.id === id) {
                link.pinned = !link.pinned;
                pinnedState = link.pinned;
                found = true;
            }
        });
    });

    if (!found) {
        return res.status(404).json({ success: false, message: 'Link not found' });
    }

    await writeDB(db);
    res.json({ success: true, id, pinned: pinnedState, resources: db.resources });
});

// 4. Delete resource link
app.delete('/api/resources/:id', async (req, res) => {
    const { id } = req.params;
    const db = await readDB();

    db.resources.forEach(group => {
        group.links = group.links.filter(l => l.id !== id);
    });

    db.resources = db.resources.filter(g => g.links.length > 0);

    await writeDB(db);
    res.json({ success: true, resources: db.resources });
});

// 5. Add Campus Document (Timetable, Mess Menu, Exam Schedule, Holiday Calendar)
app.post('/api/campus-docs', upload.single('file'), async (req, res) => {
    const { type, title, note } = req.body;
    // url may come from body or file upload
    let fileUrl = '';
    if (req.file) {
        fileUrl = `/uploads/${req.file.filename}`;
    } else if (req.body.url) {
        fileUrl = req.body.url;
    }
    if (!type || !title) {
        return res.status(400).json({ success: false, message: 'Type and title are required.' });
    }
    const db = await readDB();
    const newDoc = {
        id: 'doc-' + Date.now(),
        type,
        title,
        url: fileUrl || '#',
        note: note || '',
        updatedAt: new Date().toISOString().split('T')[0]
    };
    if (!db.campusDocs) db.campusDocs = [];
    db.campusDocs.unshift(newDoc);
    await writeDB(db);
    res.json({ success: true, doc: newDoc, campusDocs: db.campusDocs });
});

// 6. Delete Campus Document
app.delete('/api/campus-docs/:id', async (req, res) => {
    const { id } = req.params;
    const db = await readDB();

    if (db.campusDocs) {
        db.campusDocs = db.campusDocs.filter(d => d.id !== id);
        await writeDB(db);
    }

    res.json({ success: true, campusDocs: db.campusDocs });
});

// 7. Add Announcement / Special Class Note
app.post('/api/announcements', async (req, res) => {
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

    await writeDB(db);
    res.json({ success: true, announcement: newAnn, announcements: db.announcements });
});

// 8. Delete Announcement
app.delete('/api/announcements/:id', async (req, res) => {
    const { id } = req.params;
    const db = await readDB();

    if (db.announcements) {
        db.announcements = db.announcements.filter(a => a.id !== id);
        await writeDB(db);
    }

    res.json({ success: true, announcements: db.announcements });
});

// Fallback Route for Single Page Application
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
const server = app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Shared Academic Hub Server running on port ${PORT}`);
    console.log(`   Local URL: http://localhost:${PORT}`);
    if (process.env.MONGODB_URI) {
        console.log(`   Database: Connected to Persistent Cloud Database`);
    } else {
        console.log(`   Database: Local/File Fallback (Set MONGODB_URI for cloud)`);
    }
    console.log(`=======================================================`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`\n=======================================================`);
        console.log(`ℹ️ Port ${PORT} is already running in the background!`);
        console.log(`👉 Simply open your browser at: http://localhost:${PORT}`);
        console.log(`=======================================================\n`);
        process.exit(0);
    } else {
        console.error('Server error:', err);
    }
});
