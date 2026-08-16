const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

const router = express.Router();

// Helper to safely format tags into a JSON string array
function formatTags(tags) {
  if (!tags) return '["🎙️ Voice Memory"]';
  try {
    if (typeof tags === 'string') {
      const trimmed = tags.trim();
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          return JSON.stringify(Array.isArray(parsed) ? parsed : [String(parsed)]);
        } catch (e) {
          // Fallback for unquoted curl strings like [💡 Idea, 🌟 Nostalgic]
          const items = trimmed.replace(/^\[|\]$/g, '').split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
          return JSON.stringify(items.length > 0 ? items : ["🎙️ Voice Memory"]);
        }
      } else {
        return JSON.stringify([trimmed]);
      }
    } else if (Array.isArray(tags)) {
      return JSON.stringify(tags);
    }
    return JSON.stringify([String(tags)]);
  } catch (e) {
    return '["🎙️ Voice Memory"]';
  }
}

// Helper to safely parse JSON tag strings to JS Array
function parseTagsSafe(tagStr) {
  try {
    const parsed = JSON.parse(tagStr || '[]');
    return Array.isArray(parsed) ? parsed : [String(parsed)];
  } catch (e) {
    if (typeof tagStr === 'string' && tagStr.startsWith('[')) {
      const items = tagStr.replace(/^\[|\]$/g, '').split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
      return items.length > 0 ? items : ["🎙️ Voice Memory"];
    }
    return tagStr ? [String(tagStr)] : ["🎙️ Voice Memory"];
  }
}

// Multer configuration for audio uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, db.uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// GET /api/stats - Get vault summary statistics
router.get('/stats', async (req, res) => {
  try {
    const totalRow = await db.get('SELECT COUNT(*) as count, SUM(duration) as totalDuration FROM memories');
    const favRow = await db.get('SELECT COUNT(*) as favCount FROM memories WHERE is_favorite = 1');
    const allMemories = await db.all('SELECT tags FROM memories');

    const tagDistribution = {};
    allMemories.forEach(m => {
      const tags = parseTagsSafe(m.tags);
      tags.forEach(t => {
        tagDistribution[t] = (tagDistribution[t] || 0) + 1;
      });
    });

    res.json({
      totalCount: totalRow ? (totalRow.count || 0) : 0,
      totalDuration: totalRow ? (totalRow.totalDuration || 0) : 0,
      favoriteCount: favRow ? (favRow.favCount || 0) : 0,
      tagDistribution
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Failed to retrieve statistics' });
  }
});

// GET /api/memories - List all memories with search, filter, and sort
router.get('/memories', async (req, res) => {
  try {
    const { search, tag, favorite, sort } = req.query;
    let query = 'SELECT * FROM memories WHERE 1=1';
    const params = [];

    if (search && search.trim() !== '') {
      query += ' AND (title LIKE ? OR description LIKE ? OR notes LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    if (favorite === 'true' || favorite === '1') {
      query += ' AND is_favorite = 1';
    }

    if (tag && tag.trim() !== '' && tag !== 'All') {
      query += ' AND tags LIKE ?';
      params.push(`%"${tag.trim()}"%`);
    }

    // Sorting
    if (sort === 'oldest') {
      query += ' ORDER BY created_at ASC';
    } else if (sort === 'longest') {
      query += ' ORDER BY duration DESC';
    } else if (sort === 'shortest') {
      query += ' ORDER BY duration ASC';
    } else {
      // default newest
      query += ' ORDER BY created_at DESC';
    }

    const rows = await db.all(query, params);
    
    // Parse JSON tags safely
    const memories = rows.map(r => ({
      ...r,
      tags: parseTagsSafe(r.tags),
      is_favorite: Boolean(r.is_favorite)
    }));

    res.json(memories);
  } catch (err) {
    console.error('Error fetching memories:', err);
    res.status(500).json({ error: 'Failed to retrieve memories' });
  }
});

// GET /api/memories/:id - Get single memory
router.get('/memories/:id', async (req, res) => {
  try {
    const row = await db.get('SELECT * FROM memories WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Memory not found' });

    res.json({
      ...row,
      tags: parseTagsSafe(row.tags),
      is_favorite: Boolean(row.is_favorite)
    });
  } catch (err) {
    console.error('Error fetching memory:', err);
    res.status(500).json({ error: 'Failed to retrieve memory' });
  }
});

// POST /api/memories/upload - Upload new audio recording or file
router.post('/memories/upload', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const id = uuidv4();
    const title = req.body.title || `Voice Memory - ${new Date().toLocaleDateString()}`;
    const description = req.body.description || '';
    const duration = parseInt(req.body.duration || '0', 10);
    const tags = req.body.tags;
    const is_favorite = req.body.is_favorite === 'true' || req.body.is_favorite === '1' ? 1 : 0;
    const notes = req.body.notes || '';
    const filename = req.file.filename;
    const filepath = `/uploads/${filename}`;
    const created_at = new Date().toISOString();

    const formattedTags = formatTags(tags);

    const insertQuery = `
      INSERT INTO memories (id, title, description, filename, filepath, duration, tags, is_favorite, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.run(insertQuery, [id, title, description, filename, filepath, duration, formattedTags, is_favorite, notes, created_at]);

    const createdMemory = {
      id,
      title,
      description,
      filename,
      filepath,
      duration,
      tags: parseTagsSafe(formattedTags),
      is_favorite: Boolean(is_favorite),
      notes,
      created_at
    };

    res.status(201).json(createdMemory);
  } catch (err) {
    console.error('Error uploading memory:', err);
    res.status(500).json({ error: 'Failed to save voice memory' });
  }
});

// PUT /api/memories/:id - Update memory metadata
router.put('/memories/:id', async (req, res) => {
  try {
    const existing = await db.get('SELECT * FROM memories WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Memory not found' });

    const title = req.body.title !== undefined ? req.body.title : existing.title;
    const description = req.body.description !== undefined ? req.body.description : existing.description;
    const notes = req.body.notes !== undefined ? req.body.notes : existing.notes;
    const is_favorite = req.body.is_favorite !== undefined ? (req.body.is_favorite ? 1 : 0) : existing.is_favorite;
    
    let formattedTags = existing.tags;
    if (req.body.tags !== undefined) {
      formattedTags = formatTags(req.body.tags);
    }

    const updateQuery = `
      UPDATE memories
      SET title = ?, description = ?, tags = ?, is_favorite = ?, notes = ?
      WHERE id = ?
    `;

    await db.run(updateQuery, [title, description, formattedTags, is_favorite, notes, req.params.id]);

    const updated = await db.get('SELECT * FROM memories WHERE id = ?', [req.params.id]);
    res.json({
      ...updated,
      tags: parseTagsSafe(updated.tags),
      is_favorite: Boolean(updated.is_favorite)
    });
  } catch (err) {
    console.error('Error updating memory:', err);
    res.status(500).json({ error: 'Failed to update memory' });
  }
});

// DELETE /api/memories/:id - Delete memory and file
router.delete('/memories/:id', async (req, res) => {
  try {
    const existing = await db.get('SELECT * FROM memories WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Memory not found' });

    // Remove file from disk if exists
    const filePathOnDisk = path.join(db.uploadsDir, existing.filename);
    if (fs.existsSync(filePathOnDisk)) {
      try {
        fs.unlinkSync(filePathOnDisk);
      } catch (e) {
        console.error('Failed to remove audio file from disk:', e.message);
      }
    }

    await db.run('DELETE FROM memories WHERE id = ?', [req.params.id]);
    res.json({ message: 'Memory deleted successfully', id: req.params.id });
  } catch (err) {
    console.error('Error deleting memory:', err);
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

module.exports = router;
