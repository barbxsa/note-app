const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;
const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'notes.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id        TEXT PRIMARY KEY,
    title     TEXT NOT NULL DEFAULT '',
    content   TEXT NOT NULL,
    color     TEXT NOT NULL DEFAULT '#fff5b0',
    pinned    INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL
  )
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function rowToNote(row) {
  return { ...row, pinned: Boolean(row.pinned) };
}

app.get('/api/notes', (req, res) => {
  const rows = db.prepare('SELECT * FROM notes ORDER BY pinned DESC, createdAt DESC').all();
  res.json(rows.map(rowToNote));
});

app.post('/api/notes', (req, res) => {
  const content = (req.body.content || '').trim();
  if (!content) return res.status(400).json({ error: 'Conteúdo obrigatório' });

  const note = {
    id:        genId(),
    title:     (req.body.title || '').trim(),
    content,
    color:     req.body.color || '#fff5b0',
    pinned:    0,
    createdAt: new Date().toISOString()
  };

  db.prepare('INSERT INTO notes (id, title, content, color, pinned, createdAt) VALUES (?,?,?,?,?,?)')
    .run(note.id, note.title, note.content, note.color, note.pinned, note.createdAt);

  res.status(201).json(rowToNote(note));
});

app.put('/api/notes/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Não encontrado' });

  const { id, createdAt, ...updates } = req.body;
  const merged = { ...existing, ...updates };

  db.prepare('UPDATE notes SET title=?, content=?, color=?, pinned=? WHERE id=?')
    .run(merged.title, merged.content, merged.color, merged.pinned ? 1 : 0, req.params.id);

  res.json(rowToNote({ ...merged, id: req.params.id, createdAt: existing.createdAt }));
});

app.delete('/api/notes/:id', (req, res) => {
  const result = db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Não encontrado' });
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Recadinhos rodando em http://localhost:${PORT}`);
});
