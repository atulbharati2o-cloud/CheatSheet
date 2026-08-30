# Shared Academic & Campus Hub 🎓

> Collaborative Academic Resource Vault & Campus Schedules Hub for Students and Colleagues.

---

## 📁 Project Directory Structure

```
CheatSheet/
├── public/                            # Client-side static assets
│   ├── index.html                     # Main application HTML structure
│   ├── css/                           # Stylesheets
│   │   ├── style.css                  # Custom CSS styles (Theme, Grid, Modals, Responsive UI)
│   │   └── prism.css                  # Vendor syntax highlighting stylesheet
│   ├── js/                            # Client-side logic & scripts
│   │   ├── app.js                     # Main SPA frontend application logic
│   │   └── prism.js                   # Vendor syntax highlighting script
│   └── assets/                        # Static media assets
│       └── images/
│           ├── copy.svg               # Copy button icon
│           └── copy.png               # Copy button PNG asset
├── data/                              # Database directory
│   └── database.json                  # JSON file persistence storage
├── server.js                          # Node.js + Express backend server
├── package.json                       # NPM package metadata and scripts
├── package-lock.json                  # Dependency lock file
├── .gitignore                         # Git ignore configuration
└── README.md                          # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+ recommended)

### Installation
```bash
npm install
```

### Running the Server

#### Development Mode (Auto-reload on changes)
```bash
npm run dev
```

#### Production Mode
```bash
npm start
```

The application will be available at: **http://localhost:3000**

---

## 🛠️ API Reference

- `GET /api/data` - Retrieve full state (resources, campusDocs, announcements)
- `POST /api/resources` - Add a new course/resource link
- `PATCH /api/resources/:id/pin` - Toggle pin status on a resource link
- `DELETE /api/resources/:id` - Delete a resource link
- `POST /api/campus-docs` - Add a campus schedule or document
- `DELETE /api/campus-docs/:id` - Delete a campus schedule or document
- `POST /api/announcements` - Post a special note/announcement
- `DELETE /api/announcements/:id` - Delete a special note/announcement
