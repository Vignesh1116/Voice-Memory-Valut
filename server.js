const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./src/db/database');
const memoriesRouter = require('./src/routes/memories');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend UI
app.use(express.static(path.join(__dirname, 'client/dist')));

// Serve uploaded audio files
app.use('/uploads', express.static(db.uploadsDir));

// API Routes
app.use('/api', memoriesRouter);

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`🎙️ Voice Memory Vault Server running on http://localhost:${PORT}`);
  console.log(`📂 Audio storage location: ${db.uploadsDir}`);
});
