# Shared Academic & Campus Hub 🎓

> Collaborative Academic Resource Vault & Campus Schedules Hub for Students and Colleagues.
> Powered purely by **MongoDB Atlas** (persistent cloud database) and **Cloudinary** (cloud CDN asset storage).

---

## 📁 Project Directory Structure

```
CheatSheet/
├── public/                            # Client-side static assets
│   ├── index.html                     # Main application HTML structure
│   ├── css/                           # Stylesheets (Theme, Grid, Modals, Responsive UI)
│   ├── js/                            # Client-side logic & scripts (Pure MongoDB/Cloudinary API sync)
│   └── assets/                        # Static icons & media
├── server.js                          # Node.js + Express backend (MongoDB + Cloudinary integration)
├── package.json                       # NPM package metadata and scripts
├── .env                               # MongoDB Atlas & Cloudinary environment variables
├── .env.example                       # Environment template
├── vercel.json                        # Serverless deployment configuration
└── README.md                          # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- MongoDB Atlas cluster URI
- Cloudinary credentials (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`)

### Installation
```bash
npm install
```

### Running the Server

#### Start Production / Local Server
```bash
npm start
```

The application will be available at: **http://localhost:3000**

---

## 🛠️ API Reference

- `GET /api/status` - Live MongoDB & Cloudinary connection health check
- `GET /api/data` - Retrieve live hub state directly from MongoDB Atlas
- `POST /api/upload` - Direct file upload to Cloudinary CDN
- `POST /api/resources` - Add a new course/resource link or file (MongoDB + Cloudinary)
- `PATCH /api/resources/:id/pin` - Toggle pin status in MongoDB
- `DELETE /api/resources/:id` - Delete a resource link from MongoDB
- `POST /api/campus-docs` - Add a campus schedule or document (MongoDB + Cloudinary)
- `DELETE /api/campus-docs/:id` - Delete a campus schedule or document from MongoDB
- `POST /api/announcements` - Post a special note/announcement in MongoDB
- `DELETE /api/announcements/:id` - Delete a special note/announcement from MongoDB

