const initSqlJs = require('sql.js');
const express   = require('express');
const fs        = require('fs');
const path      = require('path');

const app      = express();
const PORT     = process.env.PORT || 8080;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH  = path.join(DATA_DIR, 'notes.db');

let db;

/* Persiste o banco em disco após cada escrita */
function saveDB() {
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

/* SELECT múltiplas linhas */
function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

/* SELECT uma linha */
function get(sql, params = []) {
  return all(sql, params)[0] || null;
}

/* INSERT / UPDATE / DELETE */
function run(sql, params = []) {
  db.run(sql, params);
  saveDB();
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function rowToNote(row) {
  if (!row) return null;
  return { ...row, pinned: Boolean(row.pinned) };
}

async function init() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const SQL = await initSqlJs({
    locateFile: file => path.join(__dirname, 'node_modules/sql.js/dist/', file)
  });

  db = fs.existsSync(DB_PATH)
    ? new SQL.Database(fs.readFileSync(DB_PATH))
    : new SQL.Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id        TEXT PRIMARY KEY,
      title     TEXT NOT NULL DEFAULT '',
      content   TEXT NOT NULL,
      color     TEXT NOT NULL DEFAULT '#fff5b0',
      pinned    INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL
    )
  `);
  saveDB();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/api/notes', (req, res) => {
    res.json(all('SELECT * FROM notes ORDER BY pinned DESC, createdAt DESC').map(rowToNote));
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

    run(
      'INSERT INTO notes (id, title, content, color, pinned, createdAt) VALUES (?,?,?,?,?,?)',
      [note.id, note.title, note.content, note.color, note.pinned, note.createdAt]
    );
    res.status(201).json(rowToNote(note));
  });

  app.put('/api/notes/:id', (req, res) => {
    const existing = get('SELECT * FROM notes WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Não encontrado' });

    const { id, createdAt, ...updates } = req.body;
    const merged = { ...existing, ...updates };

    run(
      'UPDATE notes SET title=?, content=?, color=?, pinned=? WHERE id=?',
      [merged.title, merged.content, merged.color, merged.pinned ? 1 : 0, req.params.id]
    );
    res.json(rowToNote({ ...merged, id: req.params.id, createdAt: existing.createdAt }));
  });

  app.delete('/api/notes/:id', (req, res) => {
    if (!get('SELECT id FROM notes WHERE id = ?', [req.params.id])) {
      return res.status(404).json({ error: 'Não encontrado' });
    }
    run('DELETE FROM notes WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  });

  app.listen(PORT, () => {
    console.log(`Lembretes rodando em http://localhost:${PORT}`);
  });
}

init().catch(err => {
  console.error('Erro ao iniciar o servidor:', err);
  process.exit(1);
});
