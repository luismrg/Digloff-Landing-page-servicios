const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Contraseña del panel de administración (Pregunta 5)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'luismrg';

// Archivo de almacenamiento de leads
const DATA_DIR = path.join(__dirname, 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(LEADS_FILE)) fs.writeFileSync(LEADS_FILE, '[]', 'utf8');
  if (!fs.existsSync(BOOKINGS_FILE)) fs.writeFileSync(BOOKINGS_FILE, '[]', 'utf8');
}
ensureStorage();

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html'],
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }
}));

// Tokens de sesión activos (en memoria)
const sessions = new Set();

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// ---------- API: Captura de Leads (formulario de email) ----------
app.post('/api/leads', (req, res) => {
  const { name, email, phone, service, message } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'Email no válido.' });
  }
  const leads = readJson(LEADS_FILE);
  const lead = {
    id: crypto.randomUUID(),
    name: String(name || '').slice(0, 120),
    email: String(email).slice(0, 160),
    phone: String(phone || '').slice(0, 40),
    service: String(service || '').slice(0, 120),
    message: String(message || '').slice(0, 1000),
    source: req.headers.referer || '',
    ip: req.ip || '',
    createdAt: new Date().toISOString()
  };
  leads.push(lead);
  writeJson(LEADS_FILE, leads);
  return res.json({ ok: true, id: lead.id });
});

// ---------- API: Reservas de cita ----------
app.post('/api/bookings', (req, res) => {
  const { name, email, phone, date, time, service, notes } = req.body || {};
  if (!name || !email) {
    return res.status(400).json({ ok: false, error: 'Nombre y email son obligatorios.' });
  }
  const bookings = readJson(BOOKINGS_FILE);
  const booking = {
    id: crypto.randomUUID(),
    name: String(name).slice(0, 120),
    email: String(email).slice(0, 160),
    phone: String(phone || '').slice(0, 40),
    date: String(date || '').slice(0, 20),
    time: String(time || '').slice(0, 20),
    service: String(service || '').slice(0, 120),
    notes: String(notes || '').slice(0, 1000),
    status: 'pendiente',
    createdAt: new Date().toISOString()
  };
  bookings.push(booking);
  writeJson(BOOKINGS_FILE, bookings);
  return res.json({ ok: true, id: booking.id });
});

// ---------- API: Autenticación del panel admin ----------
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (!password || !timingSafeEqual(password, ADMIN_PASSWORD)) {
    return res.status(401).json({ ok: false, error: 'Contraseña incorrecta.' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  sessions.add(token);
  return res.json({ ok: true, token });
});

// Middleware de autenticación admin
function authAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ ok: false, error: 'No autorizado.' });
  }
  next();
}

// ---------- API: Listar leads (protegido) ----------
app.get('/api/admin/leads', authAdmin, (req, res) => {
  const leads = readJson(LEADS_FILE).sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  );
  res.json({ ok: true, leads });
});

// ---------- API: Listar reservas (protegido) ----------
app.get('/api/admin/bookings', authAdmin, (req, res) => {
  const bookings = readJson(BOOKINGS_FILE).sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  );
  res.json({ ok: true, bookings });
});

// ---------- API: Cerrar sesión ----------
app.post('/api/admin/logout', authAdmin, (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  sessions.delete(token);
  res.json({ ok: true });
});

// ---------- Ruta del panel ----------
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ---------- SPA fallback ----------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
  console.log(`Panel de administración: http://localhost:${PORT}/admin`);
  console.log(`Contraseña por defecto: ${ADMIN_PASSWORD}`);
});
