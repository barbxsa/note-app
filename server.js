const initSqlJs = require('sql.js');
const express   = require('express');
const crypto    = require('crypto');
const fs        = require('fs');
const path      = require('path');

const app      = express();
const PORT     = process.env.PORT || 8080;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH  = path.join(DATA_DIR, 'notes.db');

/* ── credenciais via variável de ambiente ── */
const AUTH_USER = process.env.AUTH_USER || 'admin';
const AUTH_PASS = process.env.AUTH_PASS || 'lembretes';
const SECRET    = process.env.SESSION_SECRET || 'troque-este-valor-na-producao';

/* ── cookie helpers ── */
function makeToken() {
  return crypto.createHmac('sha256', SECRET).update(AUTH_USER + ':' + AUTH_PASS).digest('hex');
}

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(c => {
    const [k, ...v] = c.trim().split('=');
    if (k) out[k.trim()] = v.join('=');
  });
  return out;
}

/* ── middleware de autenticação ── */
function requireAuth(req, res, next) {
  if (req.path === '/login') return next();
  const { auth } = parseCookies(req);
  if (auth === makeToken()) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Não autorizado' });
  res.redirect('/login');
}

/* ── DB helpers ── */
let db;

function saveDB() {
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  return all(sql, params)[0] || null;
}

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
  app.use(express.urlencoded({ extended: false }));
  app.use(requireAuth);
  app.use(express.static(path.join(__dirname, 'public')));

  /* ── login ── */
  app.get('/login', (req, res) => {
    const { auth } = parseCookies(req);
    if (auth === makeToken()) return res.redirect('/');
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  });

  app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === AUTH_USER && password === AUTH_PASS) {
      const token   = makeToken();
      const maxAge  = 30 * 24 * 60 * 60; // 30 dias
      res.setHeader('Set-Cookie', `auth=${token}; HttpOnly; SameSite=Strict; Max-Age=${maxAge}; Path=/`);
      return res.redirect('/');
    }
    res.redirect('/login?error=1');
  });

  app.get('/logout', (req, res) => {
    res.setHeader('Set-Cookie', 'auth=; HttpOnly; SameSite=Strict; Max-Age=0; Path=/');
    res.redirect('/login');
  });

  /* ── API ── */
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
