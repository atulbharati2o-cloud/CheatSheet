// ==========================================================================
// Shared Academic & Campus Hub - Pure MongoDB & Cloudinary Frontend
// ==========================================================================

const API_BASE = '/api';

/**
 * Returns a Google Docs Viewer URL so PDFs open in the browser tab (not download).
 * Handles all cases:
 *  - URL ends with .pdf  (new uploads with extension fixed)
 *  - Cloudinary /raw/upload/ URLs (old uploads missing .pdf extension)
 *  - Cloudinary /image/upload/ URLs (uploads before resource_type fix)
 */
function getViewableUrl(url) {
    if (!url) return url;
    const lower = url.toLowerCase();
    const isPdf = lower.endsWith('.pdf')
        || (lower.includes('res.cloudinary.com') && (
            lower.includes('/raw/upload/')
            || lower.includes('/image/upload/')
        ));
    if (isPdf) {
        return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=false`;
    }
    return url;
}

// Live App State (Purely fetched and synced with MongoDB Atlas)
let db = {
    resources: [],
    campusDocs: [],
    announcements: []
};

let activeTab = 'resources'; // 'resources' | 'campus' | 'announcements'
let activeFilter = 'ALL';
let searchQuery = '';
let viewMode = 'grid';

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

// Fetch Live State directly from MongoDB Atlas
async function fetchServerData() {
    try {
        const response = await fetch(`${API_BASE}/data`);
        if (response.ok) {
            const res = await response.json();
            if (res.success && res.data) {
                db = {
                    resources: res.data.resources || [],
                    campusDocs: res.data.campusDocs || [],
                    announcements: res.data.announcements || []
                };
                render();
                return;
            }
        }
        showToast('Failed to load data from MongoDB.');
    } catch (e) {
        console.error('Server offline or MongoDB connection error:', e);
        showToast('Could not connect to MongoDB server.');
    }
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
    }, 2500);
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
    if (url.includes('cloudinary.com') || url.includes('uploads')) {
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
    }
    if (url.includes('drive.google.com')) {
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
    }
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`;
    }
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;
}

// Toggle Pin Status directly in MongoDB
async function togglePin(linkId) {
    try {
        const res = await fetch(`${API_BASE}/resources/${linkId}/pin`, { method: 'PATCH' });
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.resources) {
                db.resources = data.resources;
                render();
                showToast(data.pinned ? 'Link pinned to Quick Access' : 'Link unpinned');
            }
        } else {
            const err = await res.json().catch(() => ({}));
            showToast(err.message || 'Failed to update pin in MongoDB');
        }
    } catch (e) {
        console.error('Failed to update pin on server', e);
        showToast('Connection error. Could not update pin.');
    }
}

// Delete Resource Link directly from MongoDB
async function deleteLink(linkId) {
    if (!confirm('Are you sure you want to delete this resource link from MongoDB?')) return;

    try {
        const res = await fetch(`${API_BASE}/resources/${linkId}`, { method: 'DELETE' });
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.resources) {
                db.resources = data.resources;
                render();
                showToast('Resource link deleted from MongoDB');
            }
        } else {
            const err = await res.json().catch(() => ({}));
            showToast(err.message || 'Failed to delete from MongoDB');
        }
    } catch (e) {
        console.error('Failed to delete on server', e);
        showToast('Connection error. Could not delete resource.');
    }
}

// Delete Campus Document directly from MongoDB
async function deleteCampusDoc(docId) {
    if (!confirm('Are you sure you want to delete this document from MongoDB?')) return;

    try {
        const res = await fetch(`${API_BASE}/campus-docs/${docId}`, { method: 'DELETE' });
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.campusDocs) {
                db.campusDocs = data.campusDocs;
                renderCampusView();
                showToast('Document deleted from MongoDB');
            }
        } else {
            const err = await res.json().catch(() => ({}));
            showToast(err.message || 'Failed to delete document');
        }
    } catch (e) {
        console.error('Failed to delete campus doc on server', e);
        showToast('Connection error. Could not delete document.');
    }
}

// Delete Announcement directly from MongoDB
async function deleteAnnouncement(annId) {
    if (!confirm('Are you sure you want to remove this note from MongoDB?')) return;

    try {
        const res = await fetch(`${API_BASE}/announcements/${annId}`, { method: 'DELETE' });
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.announcements) {
                db.announcements = data.announcements;
                renderAnnouncementsView();
                showToast('Special note removed from MongoDB');
            }
        } else {
            const err = await res.json().catch(() => ({}));
            showToast(err.message || 'Failed to delete note');
        }
    } catch (e) {
        console.error('Failed to delete announcement on server', e);
        showToast('Connection error. Could not delete note.');
    }
}

// Render Tab 1: Resource Vault
function renderResourcesView() {
    let totalLinksCount = 0;
    let pinnedLinksCount = 0;
    const categoriesSet = new Set();

    (db.resources || []).forEach(group => {
        if (group.title) categoriesSet.add(group.title);
        (group.links || []).forEach(link => {
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
    (db.resources || []).forEach(group => {
        (group.links || []).forEach(link => {
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
    let filteredGroups = (db.resources || []).map(group => {
        let links = (group.links || []).filter(link => {
            if (activeFilter === 'PINNED' && !link.pinned) return false;
            if (activeFilter !== 'ALL' && activeFilter !== 'PINNED' && group.title !== activeFilter && group.category !== activeFilter) return false;

            if (q) {
                const matchLabel = (link.label || '').toLowerCase().includes(q);
                const matchSubject = (group.title || '').toLowerCase().includes(q);
                const matchCategory = (group.category || '').toLowerCase().includes(q);
                const matchNote = (link.note || '').toLowerCase().includes(q);
                const matchUrl = (link.href || '').toLowerCase().includes(q);
                return matchLabel || matchSubject || matchCategory || matchNote || matchUrl;
            }
            return true;
        });
        return { ...group, links };
    }).filter(group => group.links && group.links.length > 0);

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

        container.innerHTML = items.map(doc => {
            const viewUrl = getViewableUrl(doc.url);
            return `
            <div class="doc-card">
                <div class="doc-title-row">
                    <a href="${viewUrl}" target="_blank" rel="noreferrer">${doc.title}</a>
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
                    <a href="${viewUrl}" target="_blank" style="color: var(--accent-cyan); font-weight: 600; text-decoration: none;">View File &rarr;</a>
                </div>
            </div>
        `;
        }).join('');
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

// Submit Modal 1: Add Resource Link (Pure MongoDB & Cloudinary)
addLinkForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('link-subject').value.trim();
    const category = document.getElementById('link-category').value.trim();
    const label = document.getElementById('link-label').value.trim();
    const href = document.getElementById('link-url').value.trim();
    const note = document.getElementById('link-note').value.trim();
    const fileInput = document.getElementById('link-file');
    const submitBtn = document.getElementById('save-link-btn');

    const hasFile = fileInput && fileInput.files && fileInput.files.length > 0;
    if (!title || !label || (!href && !hasFile)) {
        showToast('Please provide a URL link or select a file to upload.');
        return;
    }

    const origBtnText = submitBtn ? submitBtn.innerHTML : 'Save Resource';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = hasFile ? '⏳ Uploading to Cloudinary...' : 'Saving to MongoDB...';
    }

    try {
        const formData = new FormData();
        formData.append('title', title);
        formData.append('category', category || 'Core Subject');
        formData.append('label', label);
        if (note) formData.append('note', note);

        if (hasFile) {
            formData.append('file', fileInput.files[0]);
        } else {
            formData.append('href', href);
        }

        const res = await fetch(`${API_BASE}/resources`, {
            method: 'POST',
            body: formData
        });

        if (res.ok) {
            const data = await res.json();
            if (data.success && data.resources) {
                db.resources = data.resources;
                render();
                showToast(`Saved "${label}" to MongoDB!`);
                addLinkForm.reset();
                addModal.classList.remove('open');
            }
        } else {
            const errData = await res.json().catch(() => ({}));
            showToast(errData.message || 'Failed to save resource in database');
        }
    } catch (err) {
        console.error('Failed to add link on server', err);
        showToast('Connection error. Failed to save.');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origBtnText;
        }
    }
});

// Submit Modal 2: Add Campus Document (Pure MongoDB & Cloudinary)
addDocForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('doc-type').value;
    const title = document.getElementById('doc-title').value.trim();
    const url = document.getElementById('doc-url').value.trim();
    const note = document.getElementById('doc-note').value.trim();
    const fileInput = document.getElementById('doc-file');
    const submitBtn = document.getElementById('save-doc-btn');

    const hasFile = fileInput && fileInput.files && fileInput.files.length > 0;
    if (!type || !title || (!url && !hasFile)) {
        showToast('Please provide a document title and a link or file.');
        return;
    }

    const origBtnText = submitBtn ? submitBtn.innerHTML : 'Add Document';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = hasFile ? '⏳ Uploading to Cloudinary...' : 'Saving to MongoDB...';
    }

    try {
        const formData = new FormData();
        formData.append('type', type);
        formData.append('title', title);
        if (note) formData.append('note', note);

        if (hasFile) {
            formData.append('file', fileInput.files[0]);
        } else {
            formData.append('url', url);
        }

        const res = await fetch(`${API_BASE}/campus-docs`, {
            method: 'POST',
            body: formData
        });

        if (res.ok) {
            const data = await res.json();
            if (data.success && data.campusDocs) {
                db.campusDocs = data.campusDocs;
                activeTab = 'campus';
                navTabCampus.classList.add('active');
                navTabResources.classList.remove('active');
                navTabAnnouncements.classList.remove('active');
                render();
                showToast(`Added "${title}" to MongoDB!`);
                addDocForm.reset();
                addDocModal.classList.remove('open');
            }
        } else {
            const errData = await res.json().catch(() => ({}));
            showToast(errData.message || 'Failed to upload document');
        }
    } catch (err) {
        console.error('Failed to save campus document on server:', err);
        showToast('Connection error. Failed to save.');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origBtnText;
        }
    }
});

// Submit Modal 3: Add Announcement (Pure MongoDB)
addAnnForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const badge = document.getElementById('ann-badge').value;
    const title = document.getElementById('ann-title').value.trim();
    const content = document.getElementById('ann-content').value.trim();

    if (!title || !content) return;

    try {
        const res = await fetch(`${API_BASE}/announcements`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ badge, title, content })
        });

        if (res.ok) {
            const data = await res.json();
            if (data.success && data.announcements) {
                db.announcements = data.announcements;
                activeTab = 'announcements';
                navTabAnnouncements.classList.add('active');
                navTabResources.classList.remove('active');
                navTabCampus.classList.remove('active');
                render();
                showToast(`Posted note "${title}"`);
                addAnnForm.reset();
                addAnnModal.classList.remove('open');
            }
        } else {
            const err = await res.json().catch(() => ({}));
            showToast(err.message || 'Failed to post note');
        }
    } catch (err) {
        console.error('Failed to post announcement on server:', err);
        showToast('Connection error. Failed to post note.');
    }
});

// Silent background poll — fetches latest data without disrupting the UI
async function silentRefresh() {
    try {
        const response = await fetch(`${API_BASE}/data`);
        if (!response.ok) return;
        const res = await response.json();
        if (!res.success || !res.data) return;

        // Only re-render if something actually changed
        const newSnapshot = JSON.stringify(res.data);
        const oldSnapshot = JSON.stringify({ resources: db.resources, campusDocs: db.campusDocs, announcements: db.announcements });
        if (newSnapshot !== oldSnapshot) {
            db.resources = res.data.resources || [];
            db.campusDocs = res.data.campusDocs || [];
            db.announcements = res.data.announcements || [];
            render();
            showToast('🔄 Data updated by another user');
        }
    } catch (e) {
        // Silent — don't show error toasts during background poll
    }
}

// Initialize Application on Page Load
document.addEventListener('DOMContentLoaded', () => {
    fetchServerData();

    // Auto-refresh every 30 seconds to pick up changes from other users
    setInterval(silentRefresh, 30000);

    // Also refresh immediately when the user switches back to this tab
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            silentRefresh();
        }
    });
});
