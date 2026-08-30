const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'database.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to read database
function readDB() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            return { resources: [], campusDocs: [], announcements: [] };
        }
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(raw);
    } catch (err) {
        console.error('Error reading database file:', err);
        return { resources: [], campusDocs: [], announcements: [] };
    }
}

// Helper to write database
function writeDB(data) {
    try {
        const dir = path.dirname(DB_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('Error writing database file:', err);
        return false;
    }
}

// Routes
// 1. Get full database state
app.get('/api/data', (req, res) => {
    const data = readDB();
    res.json({ success: true, data });
});

// 2. Add or append a resource link
app.post('/api/resources', (req, res) => {
    const { category, title, label, href, note } = req.body;

    if (!title || !label || !href) {
        return res.status(400).json({ success: false, message: 'Title, label, and href are required.' });
    }

    const db = readDB();
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

    writeDB(db);
    res.json({ success: true, link: newLink, resources: db.resources });
});

// 3. Toggle pin status on a resource link
app.patch('/api/resources/:id/pin', (req, res) => {
    const { id } = req.params;
    const db = readDB();
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

    writeDB(db);
    res.json({ success: true, id, pinned: pinnedState, resources: db.resources });
});

// 4. Delete resource link
app.delete('/api/resources/:id', (req, res) => {
    const { id } = req.params;
    const db = readDB();

    db.resources.forEach(group => {
        group.links = group.links.filter(l => l.id !== id);
    });

    db.resources = db.resources.filter(g => g.links.length > 0);

    writeDB(db);
    res.json({ success: true, resources: db.resources });
});

// 5. Add Campus Document (Timetable, Mess Menu, Exam Schedule, Holiday Calendar)
app.post('/api/campus-docs', (req, res) => {
    const { type, title, url, note } = req.body;

    if (!type || !title) {
        return res.status(400).json({ success: false, message: 'Type and title are required.' });
    }

    const db = readDB();
    const newDoc = {
        id: 'doc-' + Date.now(),
        type, // 'timetable' | 'mess' | 'exam' | 'holiday'
        title,
        url: url || '#',
        note: note || '',
        updatedAt: new Date().toISOString().split('T')[0]
    };

    if (!db.campusDocs) db.campusDocs = [];
    db.campusDocs.unshift(newDoc);

    writeDB(db);
    res.json({ success: true, doc: newDoc, campusDocs: db.campusDocs });
});

// 6. Delete Campus Document
app.delete('/api/campus-docs/:id', (req, res) => {
    const { id } = req.params;
    const db = readDB();

    if (db.campusDocs) {
        db.campusDocs = db.campusDocs.filter(d => d.id !== id);
        writeDB(db);
    }

    res.json({ success: true, campusDocs: db.campusDocs });
});

// 7. Add Announcement / Special Class Note
app.post('/api/announcements', (req, res) => {
    const { title, content, badge } = req.body;

    if (!title || !content) {
        return res.status(400).json({ success: false, message: 'Title and content are required.' });
    }

    const db = readDB();
    const newAnn = {
        id: 'ann-' + Date.now(),
        badge: badge || 'General',
        title,
        content,
        date: new Date().toISOString().split('T')[0]
    };

    if (!db.announcements) db.announcements = [];
    db.announcements.unshift(newAnn);

    writeDB(db);
    res.json({ success: true, announcement: newAnn, announcements: db.announcements });
});

// 8. Delete Announcement
app.delete('/api/announcements/:id', (req, res) => {
    const { id } = req.params;
    const db = readDB();

    if (db.announcements) {
        db.announcements = db.announcements.filter(a => a.id !== id);
        writeDB(db);
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

