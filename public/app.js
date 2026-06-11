let notes       = [];
let query       = '';
let editId      = null;
let activeColor = '#fff5b0';

const board      = document.getElementById('board');
const searchEl   = document.getElementById('search');
const fab        = document.getElementById('fab');
const overlay    = document.getElementById('overlay');
const modalClose = document.getElementById('modalClose');
const heading    = document.getElementById('modalHeading');
const fTitle     = document.getElementById('fTitle');
const fContent   = document.getElementById('fContent');
const swatchesEl = document.getElementById('swatches');
const preview    = document.getElementById('preview');
const btnSave    = document.getElementById('btnSave');
const btnCancel  = document.getElementById('btnCancel');
const counterEl  = document.getElementById('counter');
const toastEl    = document.getElementById('toast');

const PIN = {
  '#fff5b0': '#c49a10',
  '#ffd6ea': '#c8267a',
  '#c6f6d8': '#1e9648',
  '#e5d4ff': '#6d28d9',
  '#ffdec8': '#c4621a',
  '#c4e8ff': '#1464b4',
};

function rot(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) { h = (((h << 5) - h) + id.charCodeAt(i)) | 0; }
  return ((Math.abs(h) % 61) - 30) / 10; /* -3 .. +3 */
}

function fmt(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

/* ── escape html ── */
function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── pin SVG ── */
function pinSVG(color) {
  const c = esc(color);
  return `<svg class="note-pin" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">
    <circle cx="13" cy="11" r="7" fill="${c}" stroke="rgba(0,0,0,.35)" stroke-width="1.2"/>
    <rect x="12" y="17" width="2.4" height="8" rx="1.2" fill="rgba(0,0,0,.45)"/>
    <circle cx="13" cy="11" r="3.5" fill="rgba(255,255,255,.45)"/>
    <circle cx="11" cy="9"  r="1.2" fill="rgba(255,255,255,.7)"/>
  </svg>`;
}

/* ── render note card ── */
function noteHTML(n) {
  const r    = rot(n.id);
  const pin  = PIN[n.color] || '#999';
  const star = n.pinned ? '⭐' : '☆';
  return `
    <article class="note" data-id="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(n.title || n.content.slice(0, 40))}">
      <div class="note-body" style="background-color:${esc(n.color)};transform:rotate(${r}deg)">
        ${pinSVG(pin)}
        <button class="btn-del" data-id="${esc(n.id)}" title="Apagar" aria-label="Apagar recadinho">✕</button>
        ${n.title ? `<div class="note-title">${esc(n.title)}</div>` : ''}
        <div class="note-content">${esc(n.content)}</div>
        <div class="note-date">${fmt(n.createdAt)}</div>
        <button class="btn-star ${n.pinned ? 'starred' : ''}" data-id="${esc(n.id)}" title="${n.pinned ? 'Desafixar' : 'Fixar'}" aria-label="${n.pinned ? 'Desafixar' : 'Fixar'}">${star}</button>
      </div>
    </article>`;
}

/* ── render board ── */
function render() {
  const q  = query.trim().toLowerCase();
  let list = notes.filter(n =>
    !q || (n.title || '').toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
  );

  if (q && list.length !== notes.length) {
    counterEl.textContent = `${list.length} de ${notes.length}`;
  } else {
    counterEl.textContent = notes.length ? `${notes.length} lembrete${notes.length !== 1 ? 's' : ''}` : '';
  }

  if (!list.length) {
    board.innerHTML = `
      <div class="empty">
        <span class="empty-icon">${q ? '🔍' : '💌'}</span>
        <h2>${q ? 'Nada encontrado' : 'Nenhum lembrete ainda...'}</h2>
        <p>${q ? `Sem resultados para "${esc(q)}"` : 'Adicione o primeiro lembrete! 💝'}</p>
      </div>`;
    return;
  }

  const pinned   = list.filter(n => n.pinned);
  const unpinned = list.filter(n => !n.pinned);
  let html = '';

  if (pinned.length) {
    html += `<div class="section-header"><span>📌 Fixados</span><div class="section-rule"></div></div>
             <div class="grid">${pinned.map(noteHTML).join('')}</div>`;
  }

  if (unpinned.length) {
    if (pinned.length) {
      html += `<div class="section-header" style="margin-top:26px"><span>📝 Lembretes</span><div class="section-rule"></div></div>`;
    }
    html += `<div class="grid">${unpinned.map(noteHTML).join('')}</div>`;
  }

  board.innerHTML = html;
  bindCards();
}

/* ── bind card events ── */
function bindCards() {
  document.querySelectorAll('.note').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.btn-del,.btn-star')) return;
      openEdit(card.dataset.id);
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEdit(card.dataset.id); }
    });
  });

  document.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm('Apagar este lembrete?')) return;
      await apiDel(btn.dataset.id);
      toast('🗑️ Apagado!');
    });
  });

  document.querySelectorAll('.btn-star').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const n = notes.find(x => x.id === btn.dataset.id);
      if (!n) return;
      await apiPut(n.id, { pinned: !n.pinned });
      toast(n.pinned ? '📌 Desafixado' : '📌 Fixado!');
    });
  });
}

/* ── API ── */
async function apiGet() {
  const r = await fetch('/api/notes');
  notes = await r.json();
  notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  render();
}

async function apiPost(data) {
  const r = await fetch('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!r.ok) throw await r.json();
  const n = await r.json();
  notes.unshift(n);
  render();
  return n;
}

async function apiPut(id, data) {
  const r = await fetch(`/api/notes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!r.ok) throw await r.json();
  const n = await r.json();
  const i = notes.findIndex(x => x.id === id);
  if (i !== -1) notes[i] = n;
  render();
  return n;
}

async function apiDel(id) {
  await fetch(`/api/notes/${id}`, { method: 'DELETE' });
  notes = notes.filter(n => n.id !== id);
  render();
}

/* ── modal ── */
function openModal(isEdit) {
  heading.textContent = isEdit ? 'Editar Lembrete ✏️' : 'Novo Lembrete 💌';
  btnSave.textContent = isEdit ? 'Atualizar 💾' : 'Salvar 💌';
  overlay.classList.add('open');
  setTimeout(() => (isEdit ? fTitle : fContent).focus(), 300);
}

function closeModal() {
  overlay.classList.remove('open');
  editId         = null;
  fTitle.value   = '';
  fContent.value = '';
  fContent.classList.remove('error');
  pickColor('#fff5b0');
}

function openEdit(id) {
  const n = notes.find(x => x.id === id);
  if (!n) return;
  editId         = id;
  fTitle.value   = n.title || '';
  fContent.value = n.content;
  pickColor(n.color);
  openModal(true);
}

function pickColor(c) {
  activeColor = c;
  swatchesEl.querySelectorAll('.swatch').forEach(s => {
    s.classList.toggle('on', s.dataset.color === c);
  });
  preview.style.background = c;
}

/* ── events ── */
fab.addEventListener('click', () => openModal(false));
modalClose.addEventListener('click', closeModal);
btnCancel.addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

swatchesEl.addEventListener('click', e => {
  const s = e.target.closest('.swatch');
  if (s) pickColor(s.dataset.color);
});

btnSave.addEventListener('click', async () => {
  const content = fContent.value.trim();
  if (!content) {
    fContent.classList.add('error');
    fContent.focus();
    return;
  }
  fContent.classList.remove('error');

  try {
    if (editId) {
      await apiPut(editId, { title: fTitle.value.trim(), content, color: activeColor });
      toast('✅ Lembrete atualizado!');
    } else {
      await apiPost({ title: fTitle.value.trim(), content, color: activeColor });
      toast('💌 Lembrete salvo!');
    }
    closeModal();
  } catch (err) {
    toast('❌ Erro ao salvar. Tente novamente.');
  }
});

searchEl.addEventListener('input', () => {
  query = searchEl.value;
  render();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && overlay.classList.contains('open')) {
    e.preventDefault();
    btnSave.click();
  }
});

/* ── init ── */
apiGet();
