# 🎙️ Voice Memory Vault

An ultra-modern, full-stack, AI-powered web application for recording, saving, organizing, transcribing, and playing personal voice memories. Built with a dark glassmorphic UI aesthetic, real-time audio waveform visualizers, device vault privacy isolation, and AI Tanglish / Tamil / English voice transcription.

Live Application Link: [https://voice-memory-valut.onrender.com/](https://voice-memory-valut.onrender.com/)

---

## ✨ Features

- **🎙️ High-Fidelity Voice Recording**: Multi-format MIME recorder (`audio/webm`, `audio/mp4`, `audio/aac`, `audio/wav`) optimized for desktop browsers and mobile devices (iOS Safari & Android Chrome).
- **🤖 AI Speech-to-Text Transcription**: Powered by Groq Whisper AI. Supports **🔥 Tanglish (Tamil + English code-switching)**, Tamil, Hindi, English, and auto-detect mode.
- **🔒 Device Vault Privacy Isolation**: Unique device session encryption (`x-vault-id`). Every device / mobile phone gets its own private, isolated vault. Your memories are never visible on someone else's device.
- **🌊 Animated Audio Waveform Visualizers**: Dynamic 16-bar spectral soundwave visualizers for audio playback and live recording display.
- **📁 Dual Storage (Online API & Offline PWA Fallback)**: Automatically syncs with Express SQLite backend; falls back seamlessly to browser IndexedDB (`localforage` & `audioStore`) when offline.
- **⭐ Organization & Quick Search**: Tagging system, instant filtering by category, search by title/notes (with `⌘K` keyboard shortcut), and favorite toggling.
- **⚡ Speed Controls & Downloading**: Multi-speed audio playback (`0.5x`, `1.0x`, `1.25x`, `1.5x`, `2.0x`) and direct audio download.
- **📱 Fully Responsive Mobile UI**: Optimized for all mobile screen sizes (HIOS, Tecno, iOS Safari, Android) with bottom-sheet modals, touch targets, and mobile viewport zoom protection.

---

## 🛠️ Tech Stack

### Frontend
| Technology | Role |
| :--- | :--- |
| **React 19** | Modern UI Component Architecture |
| **Vite 8** | High-performance Frontend Build Tool & Dev Server |
| **Vanilla CSS & Glassmorphism** | Custom dark theme design system, micro-animations, glass cards |
| **Lucide React** | UI Icon set |
| **LocalForage** | Client-side IndexedDB audio blob & metadata offline storage |
| **Vite PWA** | Progressive Web App support, offline caching, & auto-update SW |

### Backend
| Technology | Role |
| :--- | :--- |
| **Node.js & Express** | RESTful API Server & Static Asset Provider |
| **SQLite3** | Embedded Relational Database for Memory Metadata & Vault Isolation |
| **Multer** | Multipart form data audio upload processor |
| **Groq Whisper AI API** | Server-side multilingual audio transcription engine |

---

## 📐 Project Structure

```
Voice-Memory-Vault/
├── client/                   # React Frontend App (Vite)
│   ├── public/               # Static icons & PWA manifest
│   ├── src/
│   │   ├── assets/           # Application wallpapers & graphics
│   │   ├── components/       # AudioPlayer, MemoryCard, Modals, Navbar, ControlsBar
│   │   ├── pages/            # Dashboard & view routing
│   │   ├── services/         # localDb.js (API client & IndexedDB fallback)
│   │   ├── App.jsx           # Main React root component
│   │   └── index.css         # Custom Glassmorphic CSS design system
│   └── vite.config.js        # Vite & PWA configuration
├── data/                     # SQLite database storage (vault.db)
├── uploads/                  # Uploaded audio files storage (/uploads/audio)
├── src/
│   ├── db/                   # SQLite database initialization & migrations
│   └── routes/               # Express API routes (/api/memories, /api/stats, /api/transcribe)
├── server.js                 # Express server entry point & static SPA fallback
├── render.yaml               # Render Web Service blueprint configuration
└── package.json              # Root dependencies & build scripts
```

---

## 🚀 How to Run Locally

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### 1. Clone the Repository
```bash
git clone https://github.com/Vignesh1116/Voice-Memory-Valut.git
cd Voice-Memory-Valut
```

### 2. Install Dependencies
Install root dependencies and client dependencies:
```bash
npm install
cd client && npm install && cd ..
```

### 3. Run Development Server
Start the Express API server and Vite client concurrently:
```bash
# Terminal 1: Run Express Server (Port 3000)
npm run dev

# Terminal 2: Run Client Frontend (Port 5173)
cd client
npm run dev
```
Open your browser at `http://localhost:5173`.

### 4. Build for Production
To test the production build locally:
```bash
npm run build
npm start
```
Open your browser at `http://localhost:3000`.

---

## ☁️ Deployment (Render)

This repository is pre-configured for deployment on **Render**:

- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Port**: Render automatically binds `process.env.PORT` (defaults to `10000` or `3000`).
- **Persistent Disk (Optional)**: Set `DATA_DIR=/var/data` and `UPLOADS_DIR=/var/data/uploads` on Render for persistent SQLite & audio file storage across server restarts.

Live App URL: **[https://voice-memory-valut.onrender.com/](https://voice-memory-valut.onrender.com/)**

---

## 📄 License

This project is open source and available under the [ISC License](LICENSE).