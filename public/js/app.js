// ==========================================================================
// Shared Academic & Campus Hub - Main Client Application
// ==========================================================================

const API_BASE = '/api';
const LOCAL_STORAGE_KEY = 'academic_hub_offline_backup_v3';
const DELETED_IDS_KEY = 'academic_hub_deleted_ids_v1';

function getDeletedIds() {
    try {
        const stored = localStorage.getItem(DELETED_IDS_KEY);
        return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch (e) {
        return new Set();
    }
}

function trackDeletedId(id) {
    if (!id) return;
    const set = getDeletedIds();
    set.add(id);
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(Array.from(set)));
}

function getLocalDatabase() {
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!local) return null;
    try {
        return JSON.parse(local);
    } catch (e) {
        return null;
    }
}

function mergeDatabase(serverData, localData) {
    const deletedIds = getDeletedIds();
    const merged = {
        resources: [],
        campusDocs: [],
        announcements: []
    };

    const sResources = (serverData && serverData.resources) || [];
    const lResources = (localData && localData.resources) || [];

    const groupsMap = new Map();

    function processGroup(group) {
        if (!group || !group.title) return;
        const titleLower = group.title.toLowerCase();
        if (!groupsMap.has(titleLower)) {
            groupsMap.set(titleLower, {
                category: group.category || 'Core Subject',
                title: group.title,
                links: []
            });
        }
        const targetGroup = groupsMap.get(titleLower);

        (group.links || []).forEach(link => {
            if (!link || !link.id) return;
            if (deletedIds.has(link.id)) return;

            const existingIdx = targetGroup.links.findIndex(l => l.id === link.id);
            if (existingIdx === -1) {
                targetGroup.links.push({ ...link });
            } else {
                targetGroup.links[existingIdx] = {
                    ...targetGroup.links[existingIdx],
                    ...link
                };
            }
        });
    }

    sResources.forEach(processGroup);
    lResources.forEach(processGroup);

    merged.resources = Array.from(groupsMap.values()).filter(g => g.links.length > 0);

    const sDocs = (serverData && serverData.campusDocs) || [];
    const lDocs = (localData && localData.campusDocs) || [];
    const docsMap = new Map();

    [...sDocs, ...lDocs].forEach(doc => {
        if (!doc || !doc.id) return;
        if (deletedIds.has(doc.id)) return;
        if (!docsMap.has(doc.id)) {
            docsMap.set(doc.id, { ...doc });
        }
    });
    merged.campusDocs = Array.from(docsMap.values());

    const sAnns = (serverData && serverData.announcements) || [];
    const lAnns = (localData && localData.announcements) || [];
    const annsMap = new Map();

    [...sAnns, ...lAnns].forEach(ann => {
        if (!ann || !ann.id) return;
        if (deletedIds.has(ann.id)) return;
        if (!annsMap.has(ann.id)) {
            annsMap.set(ann.id, { ...ann });
        }
    });
    merged.announcements = Array.from(annsMap.values());

    return merged;
}

// Default Fallback Data if server is unreachable
const defaultDatabase = {
    resources: [
        {
            category: 'Quick Access',
            title: 'Main University Drive',
            links: [
                { id: 'lnk-1', label: 'CSE Drive', href: 'https://drive.google.com/drive/folders/1tXxLKfFfA-3LmIS7XzSRTjG4d9Tw7ooS', note: 'Main CSE department shared folder for all semesters', pinned: true },
                { id: 'lnk-2', label: '5th Semester Drive', href: 'https://drive.google.com/drive/folders/1TFjMZxKGUKWHtb3dy-XMWmFIPs9cJjtr', note: 'Semester 5 course slides, lab assignments & past papers', pinned: true }
            ]
        },
        {
            category: 'Core Subject',
            title: 'Computer Networking',
            links: [
                { id: 'lnk-3', label: 'Jim Kurose Website', href: 'https://gaia.cs.umass.edu/kurose_ross/ppt.php', note: 'Official Kurose & Ross 8th edition lecture presentation slides', pinned: false },
                { id: 'lnk-4', label: 'Jim Kurose YouTube Playlist', href: 'https://youtube.com/playlist?list=PLByK_3hwzY3Tysh-SY9MKZhMm9wIfNOas&si=LH4uJy3BSz6syP8E', note: 'Author video lectures on Socket programming & TCP/IP layer', pinned: false },
                { id: 'lnk-5', label: 'CN Google Drive', href: 'https://drive.google.com/drive/folders/1DNI22B435dGajyfw4jJBNOeSA44rZDF2', note: 'Contains lab manuals, Wireshark PCAP files & PYQ solutions', pinned: true }
            ]
        },
        {
            category: 'Core Subject',
            title: 'Operating System',
            links: [
                { id: 'lnk-6', label: 'OS Google Drive', href: 'https://drive.google.com/drive/folders/1_1iAjGGjXmdWbKSdVYTQ87E7AhuFcwRl', note: 'Process synchronization notes & CPU scheduling C programs', pinned: false }
            ]
        },
        {
            category: 'Core Subject',
            title: 'NFT',
            links: [
                { id: 'lnk-7', label: 'NFT Google Drive', href: 'https://drive.google.com/drive/folders/1gE1Nq3XoCB2PH1O6s4uNZYK1Gs77ewan', note: 'Network Filter & Technology study resources', pinned: false }
            ]
        },
        {
            category: 'Core Subject',
            title: 'IPU',
            links: [
                { id: 'lnk-8', label: 'IPU Google Drive', href: 'https://drive.google.com/drive/folders/1rXQeF3UbrASBfLzoutkN4d27msMVKMHt', note: 'Official university syllabus & exam circulars', pinned: false }
            ]
        }
    ],
    campusDocs: [
        { id: 'doc-1', type: 'timetable', title: '5th Sem CSE Class Timetable (Fall 2026)', url: 'https://drive.google.com/drive/folders/1TFjMZxKGUKWHtb3dy-XMWmFIPs9cJjtr', note: 'Mon-Fri 9:00 AM to 5:00 PM • Room 304, Block C', updatedAt: '2026-08-25' },
        { id: 'doc-2', type: 'mess', title: 'Hostel Mess Weekly Menu', url: '#', note: 'Special Lunch on Wednesdays & Sunday Dinner Dessert', updatedAt: '2026-08-20' },
        { id: 'doc-3', type: 'exam', title: 'Mid-Term Examination Datesheet', url: '#', note: 'Exams start 15th October. CN on Day 1, OS on Day 3.', updatedAt: '2026-08-28' },
        { id: 'doc-4', type: 'holiday', title: 'University Academic & Holiday Calendar 2026', url: '#', note: 'Includes list of gazetted holidays & semester break schedule', updatedAt: '2026-08-01' }
    ],
    announcements: [
        { id: 'ann-1', badge: 'Exam', title: 'CN Lab Assignment 2 Deadline', content: 'Socket Programming assignment in Python/C is due by this Friday 11:59 PM. Submit on drive.', date: '2026-08-29' },
        { id: 'ann-2', badge: 'Important', title: 'Guest Lecture on Cloud Operating Systems', content: 'Join us on Thursday at 2:00 PM in Seminar Hall B for the guest session.', date: '2026-08-28' }
    ]
};

// Global App State
let db = { ...defaultDatabase };
let activeTab = 'resources'; // 'resources' | 'campus' | 'announcements'
let activeFilter = 'ALL';
let searchQuery = '';
let viewMode = 'grid';
let isServerConnected = false;

// DOM Elements
const navTabResources = document.getElementById('nav-tab-resources');
const navTabCampus = document.getElementById('nav-tab-campus');
const navTabAnnouncements = document.getElementById('nav-tab-announcements');

const viewResources = document.getElementById('view-resources');
const viewCampus = document.getElementById('view-campus');
const viewAnnouncements = document.getElementById('view-announcements');

const searchInput = document.getElementById('search-input');
const filterPillsContainer = document.getElementById('filter-pills');
const linksGrid = document.getElementById('links-grid');
const pinnedSection = document.getElementById('pinned-section');
const pinnedGrid = document.getElementById('pinned-grid');
const viewGridBtn = document.getElementById('view-grid-btn');
const viewListBtn = document.getElementById('view-list-btn');

// Stats Elements
const statSubjects = document.getElementById('stat-subjects');
const statLinks = document.getElementById('stat-links');
const statPinned = document.getElementById('stat-pinned');

// Campus Lists
const timetableList = document.getElementById('timetable-list');
const messList = document.getElementById('mess-list');
const examList = document.getElementById('exam-list');
const holidayList = document.getElementById('holiday-list');
const announcementsGrid = document.getElementById('announcements-grid');

// Modals & Buttons
const addModal = document.getElementById('add-modal');
const openAddModalBtn = document.getElementById('open-add-modal');
const closeAddModalBtn = document.getElementById('close-add-modal');
const cancelAddModalBtn = document.getElementById('cancel-add-modal');
const addLinkForm = document.getElementById('add-link-form');

const addDocModal = document.getElementById('add-doc-modal');
const openAddDocModalBtn = document.getElementById('open-add-doc-modal');
const openAddDocModalBtn2 = document.getElementById('open-add-doc-modal-2');
const closeAddDocModalBtn = document.getElementById('close-add-doc-modal');
const cancelAddDocModalBtn = document.getElementById('cancel-add-doc-modal');
const addDocForm = document.getElementById('add-doc-form');

const addAnnModal = document.getElementById('add-ann-modal');
const openAddAnnModalBtn = document.getElementById('open-add-ann-modal');
const closeAddAnnModalBtn = document.getElementById('close-add-ann-modal');
const cancelAddAnnModalBtn = document.getElementById('cancel-add-ann-modal');
const addAnnForm = document.getElementById('add-ann-form');

const toastContainer = document.getElementById('toast-container');

// Load Data from Server API or LocalStorage Backup
async function fetchServerData() {
    const localData = getLocalDatabase() || defaultDatabase;
    try {
        const response = await fetch(`${API_BASE}/data`);
        if (response.ok) {
            const res = await response.json();
            if (res.success && res.data) {
                isServerConnected = true;
                db = mergeDatabase(res.data, localData);
                saveLocalBackup();
                render();
                return;
            }
        }
    } catch (e) {
        console.warn('Server offline or unreachable. Falling back to local data.');
        isServerConnected = false;
    }

    db = mergeDatabase(null, localData);
    saveLocalBackup();
    render();
}

function saveLocalBackup() {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(db));
}

// Toast Notifications
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>${message}</span>
    `;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2400);
}

// Copy Link to Clipboard
function copyLink(url) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(url).then(() => {
            showToast('Link copied to clipboard!');
        }).catch(() => fallbackCopy(url));
    } else {
        fallbackCopy(url);
    }
}

function fallbackCopy(url) {
    const textArea = document.createElement('textarea');
    textArea.value = url;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        showToast('Link copied to clipboard!');
    } catch (err) {
        showToast('Failed to copy link.');
    }
    document.body.removeChild(textArea);
}

// Helper: SVG Icon based on URL
function getLinkIconSvg(url) {
    if (!url) return '';
    if (url.includes('drive.google.com')) {
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
    }
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`;
    }
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;
}

// Toggle Pin Status
async function togglePin(linkId) {
    db.resources.forEach(group => {
        group.links.forEach(link => {
            if (link.id === linkId) link.pinned = !link.pinned;
        });
    });
    saveLocalBackup();
    render();

    if (isServerConnected) {
        try {
            const res = await fetch(`${API_BASE}/resources/${linkId}/pin`, { method: 'PATCH' });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.resources) {
                    db = mergeDatabase({ resources: data.resources }, db);
                    saveLocalBackup();
                    render();
                }
            }
        } catch (e) {
            console.error('Failed to update pin on server', e);
        }
    }
}

// Delete Resource Link
async function deleteLink(linkId) {
    if (!confirm('Are you sure you want to delete this resource link for everyone?')) return;

    trackDeletedId(linkId);

    db.resources.forEach(group => {
        group.links = group.links.filter(l => l.id !== linkId);
    });
    db.resources = db.resources.filter(g => g.links.length > 0);
    saveLocalBackup();
    render();
    showToast('Resource link removed');

    if (isServerConnected) {
        try {
            const res = await fetch(`${API_BASE}/resources/${linkId}`, { method: 'DELETE' });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.resources) {
                    db = mergeDatabase({ resources: data.resources }, db);
                    saveLocalBackup();
                    render();
                }
            }
        } catch (e) {
            console.error('Failed to delete on server', e);
        }
    }
}

// Delete Campus Document
async function deleteCampusDoc(docId) {
    if (!confirm('Are you sure you want to delete this document?')) return;

    trackDeletedId(docId);

    if (db.campusDocs) {
        db.campusDocs = db.campusDocs.filter(d => d.id !== docId);
    }
    saveLocalBackup();
    renderCampusView();
    showToast('Document deleted');

    if (isServerConnected) {
        try {
            const res = await fetch(`${API_BASE}/campus-docs/${docId}`, { method: 'DELETE' });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.campusDocs) {
                    db = mergeDatabase({ campusDocs: data.campusDocs }, db);
                    saveLocalBackup();
                    renderCampusView();
                }
            }
        } catch (e) {
            console.error('Failed to delete campus doc on server', e);
        }
    }
}

// Delete Announcement
async function deleteAnnouncement(annId) {
    if (!confirm('Are you sure you want to remove this note?')) return;

    trackDeletedId(annId);

    if (db.announcements) {
        db.announcements = db.announcements.filter(a => a.id !== annId);
    }
    saveLocalBackup();
    renderAnnouncementsView();
    showToast('Special note removed');

    if (isServerConnected) {
        try {
            const res = await fetch(`${API_BASE}/announcements/${annId}`, { method: 'DELETE' });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.announcements) {
                    db = mergeDatabase({ announcements: data.announcements }, db);
                    saveLocalBackup();
                    renderAnnouncementsView();
                }
            }
        } catch (e) {
            console.error('Failed to delete announcement on server', e);
        }
    }
}

// Render Tab 1: Resource Vault
function renderResourcesView() {
    let totalLinksCount = 0;
    let pinnedLinksCount = 0;
    const categoriesSet = new Set();

    db.resources.forEach(group => {
        if (group.title) categoriesSet.add(group.title);
        group.links.forEach(link => {
            totalLinksCount++;
            if (link.pinned) pinnedLinksCount++;
        });
    });

    if (statSubjects) statSubjects.textContent = db.resources.length;
    if (statLinks) statLinks.textContent = totalLinksCount;
    if (statPinned) statPinned.textContent = pinnedLinksCount;

    // Filter Pills
    const pills = ['ALL', 'PINNED', ...Array.from(categoriesSet)];
    filterPillsContainer.innerHTML = pills.map(pill => {
        const isActive = activeFilter === pill ? 'active' : '';
        const label = pill === 'ALL' ? 'All Links' : (pill === 'PINNED' ? '★ Pinned' : pill);
        return `<button class="filter-pill ${isActive}" onclick="setFilter('${pill}')">${label}</button>`;
    }).join('');

    // Pinned Shelf
    const pinnedLinks = [];
    db.resources.forEach(group => {
        group.links.forEach(link => {
            if (link.pinned) {
                pinnedLinks.push({ ...link, subject: group.title });
            }
        });
    });

    if (pinnedLinks.length === 0 || activeFilter === 'PINNED') {
        pinnedSection.style.display = 'none';
    } else {
        pinnedSection.style.display = 'block';
        pinnedGrid.innerHTML = pinnedLinks.map(item => `
            <div class="pinned-item">
                <div class="pinned-item-info">
                    <div class="pinned-icon">
                        ${getLinkIconSvg(item.href)}
                    </div>
                    <div>
                        <a href="${item.href}" target="_blank" rel="noreferrer" class="pinned-item-title" title="${item.label}">
                            ${item.label}
                        </a>
                        <div style="font-size: 0.72rem; color: var(--text-dim);">${item.subject}</div>
                    </div>
                </div>
                <div class="link-actions">
                    <button class="action-icon-btn" onclick="copyLink('${item.href}')" title="Copy Link">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    </button>
                    <button class="action-icon-btn pin-btn active" onclick="togglePin('${item.id}')" title="Unpin Link">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Main Grid Filter
    const q = searchQuery.toLowerCase().trim();
    let filteredGroups = db.resources.map(group => {
        let links = group.links.filter(link => {
            if (activeFilter === 'PINNED' && !link.pinned) return false;
            if (activeFilter !== 'ALL' && activeFilter !== 'PINNED' && group.title !== activeFilter && group.category !== activeFilter) return false;

            if (q) {
                const matchLabel = link.label.toLowerCase().includes(q);
                const matchSubject = group.title.toLowerCase().includes(q);
                const matchCategory = group.category.toLowerCase().includes(q);
                const matchNote = (link.note || '').toLowerCase().includes(q);
                const matchUrl = link.href.toLowerCase().includes(q);
                return matchLabel || matchSubject || matchCategory || matchNote || matchUrl;
            }
            return true;
        });
        return { ...group, links };
    }).filter(group => group.links.length > 0);

    if (filteredGroups.length === 0) {
        linksGrid.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <h4>No matching resources found</h4>
                <p style="color: var(--text-dim); font-size: 0.88rem; margin-top: 4px;">
                    Try adjusting your search terms or click "+ Add Link" to create one.
                </p>
            </div>
        `;
        return;
    }

    linksGrid.className = `links-grid ${viewMode === 'list' ? 'list-view' : ''}`;
    linksGrid.innerHTML = filteredGroups.map(group => `
        <article class="resource-card">
            <div class="card-header">
                <div class="card-header-left">
                    <span class="tag">${group.category}</span>
                    <h3>${group.title}</h3>
                </div>
            </div>
            <ul class="link-list">
                ${group.links.map(link => `
                    <li class="link-item">
                        <div class="link-item-main">
                            <div class="link-item-left">
                                <span class="link-icon">${getLinkIconSvg(link.href)}</span>
                                <a href="${link.href}" target="_blank" rel="noreferrer" title="${link.label}">${link.label}</a>
                            </div>
                            <div class="link-actions">
                                <button class="action-icon-btn" onclick="copyLink('${link.href}')" title="Copy Link">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                </button>
                                <button class="action-icon-btn pin-btn ${link.pinned ? 'active' : ''}" onclick="togglePin('${link.id}')" title="${link.pinned ? 'Unpin Link' : 'Pin Link'}">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="${link.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                </button>
                                <button class="action-icon-btn delete-btn" onclick="deleteLink('${link.id}')" title="Delete Link">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                            </div>
                        </div>
                        ${link.note ? `
                            <div class="special-note-box">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                <span>${link.note}</span>
                            </div>
                        ` : ''}
                    </li>
                `).join('')}
            </ul>
        </article>
    `).join('');
}

function setFilter(filter) {
    activeFilter = filter;
    renderResourcesView();
}

// Render Tab 2: Campus Documents & Schedules
function renderCampusView() {
    const docs = db.campusDocs || [];
    const q = searchQuery.toLowerCase().trim();

    const renderCategoryDocs = (type, container) => {
        let items = docs.filter(d => d.type === type);
        if (q) {
            items = items.filter(d => d.title.toLowerCase().includes(q) || (d.note || '').toLowerCase().includes(q));
        }

        if (items.length === 0) {
            container.innerHTML = `<div style="font-size: 0.82rem; color: var(--text-dim); padding: 12px; text-align: center;">No documents listed</div>`;
            return;
        }

        container.innerHTML = items.map(doc => `
            <div class="doc-card">
                <div class="doc-title-row">
                    <a href="${doc.url}" target="_blank" rel="noreferrer">${doc.title}</a>
                    <div class="link-actions">
                        <button class="action-icon-btn" onclick="copyLink('${doc.url}')" title="Copy Document Link">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </button>
                        <button class="action-icon-btn delete-btn" onclick="deleteCampusDoc('${doc.id}')" title="Delete Document">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </div>
                ${doc.note ? `<div class="doc-note-text">💡 ${doc.note}</div>` : ''}
                <div class="doc-footer">
                    <span>Updated ${doc.updatedAt || 'recently'}</span>
                    <a href="${doc.url}" target="_blank" style="color: var(--accent-cyan); font-weight: 600; text-decoration: none;">View File &rarr;</a>
                </div>
            </div>
        `).join('');
    };

    renderCategoryDocs('timetable', timetableList);
    renderCategoryDocs('mess', messList);
    renderCategoryDocs('exam', examList);
    renderCategoryDocs('holiday', holidayList);
}

// Render Tab 3: Special Notes & Announcements
function renderAnnouncementsView() {
    let anns = db.announcements || [];
    const q = searchQuery.toLowerCase().trim();

    if (q) {
        anns = anns.filter(a => a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q));
    }

    if (anns.length === 0) {
        announcementsGrid.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path></svg>
                <h4>No special notes posted yet</h4>
                <p style="color: var(--text-dim); font-size: 0.88rem; margin-top: 4px;">Click "+ Post Special Note" to share important class announcements.</p>
            </div>
        `;
        return;
    }

    announcementsGrid.innerHTML = anns.map(ann => `
        <div class="announcement-card">
            <div>
                <span class="ann-badge ${ann.badge || 'General'}">${ann.badge || 'General'}</span>
                <h3>${ann.title}</h3>
                <p>${ann.content}</p>
            </div>
            <div class="ann-footer">
                <span>Posted on ${ann.date || 'Today'}</span>
                <button class="action-icon-btn delete-btn" onclick="deleteAnnouncement('${ann.id}')" title="Delete Note">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        </div>
    `).join('');
}

// Master Render Function
function render() {
    if (activeTab === 'resources') {
        viewResources.style.display = 'block';
        viewCampus.style.display = 'none';
        viewAnnouncements.style.display = 'none';
        renderResourcesView();
    } else if (activeTab === 'campus') {
        viewResources.style.display = 'none';
        viewCampus.style.display = 'block';
        viewAnnouncements.style.display = 'none';
        renderCampusView();
    } else if (activeTab === 'announcements') {
        viewResources.style.display = 'none';
        viewCampus.style.display = 'none';
        viewAnnouncements.style.display = 'block';
        renderAnnouncementsView();
    }
}

// Navigation Tab Switches
navTabResources.addEventListener('click', () => {
    activeTab = 'resources';
    navTabResources.classList.add('active');
    navTabCampus.classList.remove('active');
    navTabAnnouncements.classList.remove('active');
    render();
});

navTabCampus.addEventListener('click', () => {
    activeTab = 'campus';
    navTabCampus.classList.add('active');
    navTabResources.classList.remove('active');
    navTabAnnouncements.classList.remove('active');
    render();
});

navTabAnnouncements.addEventListener('click', () => {
    activeTab = 'announcements';
    navTabAnnouncements.classList.add('active');
    navTabResources.classList.remove('active');
    navTabCampus.classList.remove('active');
    render();
});

// Search input
searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    render();
});

// View mode toggles
viewGridBtn.addEventListener('click', () => {
    viewMode = 'grid';
    viewGridBtn.classList.add('active');
    viewListBtn.classList.remove('active');
    renderResourcesView();
});

viewListBtn.addEventListener('click', () => {
    viewMode = 'list';
    viewListBtn.classList.add('active');
    viewGridBtn.classList.remove('active');
    renderResourcesView();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInput.focus();
    } else if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        searchInput.focus();
    } else if (e.key === 'Escape') {
        closeAllModals();
    }
});

// Modal Helpers
function closeAllModals() {
    addModal.classList.remove('open');
    addDocModal.classList.remove('open');
    addAnnModal.classList.remove('open');
}

openAddModalBtn.addEventListener('click', () => { addModal.classList.add('open'); document.getElementById('link-subject').focus(); });
closeAddModalBtn.addEventListener('click', () => addModal.classList.remove('open'));
cancelAddModalBtn.addEventListener('click', () => addModal.classList.remove('open'));

const triggerDocModal = () => { addDocModal.classList.add('open'); document.getElementById('doc-title').focus(); };
openAddDocModalBtn.addEventListener('click', triggerDocModal);
openAddDocModalBtn2.addEventListener('click', triggerDocModal);
closeAddDocModalBtn.addEventListener('click', () => addDocModal.classList.remove('open'));
cancelAddDocModalBtn.addEventListener('click', () => addDocModal.classList.remove('open'));

openAddAnnModalBtn.addEventListener('click', () => { addAnnModal.classList.add('open'); document.getElementById('ann-title').focus(); });
closeAddAnnModalBtn.addEventListener('click', () => addAnnModal.classList.remove('open'));
cancelAddAnnModalBtn.addEventListener('click', () => addAnnModal.classList.remove('open'));

// Submit Modal 1: Add Resource Link
addLinkForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('link-subject').value.trim();
    const category = document.getElementById('link-category').value.trim();
    const label = document.getElementById('link-label').value.trim();
    const href = document.getElementById('link-url').value.trim();
    const note = document.getElementById('link-note').value.trim();

    if (!title || !label || !href) return;

    const newLink = { id: 'lnk-' + Date.now(), label, href, note: note || '', pinned: false };
    let group = db.resources.find(g => g.title.toLowerCase() === title.toLowerCase());

    if (group) {
        group.links.push(newLink);
    } else {
        db.resources.push({ category: category || 'Core Subject', title, links: [newLink] });
    }

    saveLocalBackup();
    addLinkForm.reset();
    addModal.classList.remove('open');
    render();
    showToast(`Added "${label}"!`);

    if (isServerConnected) {
        try {
            const res = await fetch(`${API_BASE}/resources`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category, title, label, href, note })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.resources) {
                    db = mergeDatabase({ resources: data.resources }, db);
                    saveLocalBackup();
                    render();
                }
            }
        } catch (err) {
            console.error('Failed to save link to server', err);
        }
    }
});

// Submit Modal 2: Add Campus Document
addDocForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('doc-type').value;
    const title = document.getElementById('doc-title').value.trim();
    const url = document.getElementById('doc-url').value.trim();
    const note = document.getElementById('doc-note').value.trim();

    if (!type || !title) return;

    const newDoc = {
        id: 'doc-' + Date.now(),
        type,
        title,
        url: url || '#',
        note,
        updatedAt: new Date().toISOString().split('T')[0]
    };

    if (!db.campusDocs) db.campusDocs = [];
    db.campusDocs.unshift(newDoc);
    saveLocalBackup();

    addDocForm.reset();
    addDocModal.classList.remove('open');
    activeTab = 'campus';
    navTabCampus.classList.add('active');
    navTabResources.classList.remove('active');
    navTabAnnouncements.classList.remove('active');
    render();
    showToast(`Added document "${title}"`);

    if (isServerConnected) {
        try {
            const res = await fetch(`${API_BASE}/campus-docs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, title, url, note })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.campusDocs) {
                    db = mergeDatabase({ campusDocs: data.campusDocs }, db);
                    saveLocalBackup();
                    render();
                }
            }
        } catch (err) {
            console.error('Failed to save doc to server', err);
        }
    }
});

// Submit Modal 3: Add Announcement
addAnnForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const badge = document.getElementById('ann-badge').value;
    const title = document.getElementById('ann-title').value.trim();
    const content = document.getElementById('ann-content').value.trim();

    if (!title || !content) return;

    const newAnn = {
        id: 'ann-' + Date.now(),
        badge,
        title,
        content,
        date: new Date().toISOString().split('T')[0]
    };

    if (!db.announcements) db.announcements = [];
    db.announcements.unshift(newAnn);
    saveLocalBackup();

    addAnnForm.reset();
    addAnnModal.classList.remove('open');
    activeTab = 'announcements';
    navTabAnnouncements.classList.add('active');
    navTabResources.classList.remove('active');
    navTabCampus.classList.remove('active');
    render();
    showToast(`Posted note "${title}"`);

    if (isServerConnected) {
        try {
            const res = await fetch(`${API_BASE}/announcements`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ badge, title, content })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.announcements) {
                    db = mergeDatabase({ announcements: data.announcements }, db);
                    saveLocalBackup();
                    render();
                }
            }
        } catch (err) {
            console.error('Failed to save announcement to server', err);
        }
    }
});

// Background Polling (Every 10 seconds for real-time collaboration with colleagues)
setInterval(() => {
    fetchServerData();
}, 10000);

// Initialize Application
fetchServerData();
