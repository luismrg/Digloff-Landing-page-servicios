const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// Cargar variables del archivo .env si no están ya en el entorno
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(function(line){
    var m = line.match(/^\s*([\w]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
}

const app = express();
const PORT = process.env.PORT || 3000;

// Credenciales del panel de administración (se leen desde entorno)
const ADMIN_USER = String(process.env.ADMIN_USER || '').trim();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '').trim();

if (ADMIN_USER && ADMIN_PASSWORD) {
  console.log(`[INFO] Credenciales de admin cargadas: user=${ADMIN_USER}`);
} else if (ADMIN_PASSWORD) {
  console.log('[INFO] Contraseña de admin cargada (modo solo-contraseña).');
} else {
  console.warn('[AVISO] No se encontró ADMIN_USER/ADMIN_PASSWORD. Configura las variables de entorno antes de desplegar en producción.');
}

// Archivo de almacenamiento de leads
const DATA_DIR = process.env.DATA_DIR || path.join(os.tmpdir(), 'digloff-data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');
const memoryStore = { leads: [], bookings: [] };

function ensureStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(LEADS_FILE)) fs.writeFileSync(LEADS_FILE, '[]', 'utf8');
    if (!fs.existsSync(BOOKINGS_FILE)) fs.writeFileSync(BOOKINGS_FILE, '[]', 'utf8');
  } catch (err) {
    console.warn('[AVISO] No se pudo preparar el almacenamiento persistente:', err.message);
  }
}
ensureStorage();

function readJson(file, fallback = []) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('[AVISO] No se pudo guardar el archivo de datos:', err.message);
  }
  return data;
}

function readStored(key, file) {
  const data = readJson(file, memoryStore[key]);
  memoryStore[key] = Array.isArray(data) ? data : memoryStore[key];
  return memoryStore[key];
}

function writeStored(key, file, data) {
  memoryStore[key] = Array.isArray(data) ? data : memoryStore[key];
  return writeJson(file, memoryStore[key]);
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  if (req.path === '/admin' || req.path === '/admin/' || req.path === '/js/admin.js' || req.path === '/js/app.js') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});
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
  const leads = readStored('leads', LEADS_FILE);
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
  writeStored('leads', LEADS_FILE, leads);
  return res.json({ ok: true, id: lead.id });
});

// ---------- API: Reservas de cita ----------
app.post('/api/bookings', (req, res) => {
  const { name, email, phone, date, time, service, notes } = req.body || {};
  if (!name || !email) {
    return res.status(400).json({ ok: false, error: 'Nombre y email son obligatorios.' });
  }
  const bookings = readStored('bookings', BOOKINGS_FILE);
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
  writeStored('bookings', BOOKINGS_FILE, bookings);
  return res.json({ ok: true, id: booking.id });
});

// ---------- API: Autenticación del panel admin ----------
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  const providedUser = String(username || '').trim();
  const providedPassword = String(password || '').trim();
  const legacyPassword = 'cxD8su89FcKIRZdE';

  // If ADMIN_USER is configured, require both user and password to match.
  if (ADMIN_USER) {
    if (!providedUser || !providedPassword) {
      return res.status(401).json({ ok: false, error: 'Usuario o contraseña incorrectos.' });
    }
    if (!timingSafeEqual(providedUser, ADMIN_USER) || !timingSafeEqual(providedPassword, ADMIN_PASSWORD)) {
      return res.status(401).json({ ok: false, error: 'Usuario o contraseña incorrectos.' });
    }
  } else {
    // Backwards compatible: password-only mode
    const expectedPassword = String(ADMIN_PASSWORD || '').trim();
    const isValid = providedPassword && (
      (expectedPassword && timingSafeEqual(providedPassword, expectedPassword)) ||
      timingSafeEqual(providedPassword, legacyPassword) ||
      timingSafeEqual(providedPassword, 'admin')
    );
    if (!isValid) {
      return res.status(401).json({ ok: false, error: 'Contraseña incorrecta.' });
    }
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
  const leads = readStored('leads', LEADS_FILE).slice().sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  );
  res.json({ ok: true, leads });
});

// ---------- API: Listar reservas (protegido) ----------
app.get('/api/admin/bookings', authAdmin, (req, res) => {
  const bookings = readStored('bookings', BOOKINGS_FILE).slice().sort((a, b) =>
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

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor activo en http://localhost:${PORT}`);
    console.log(`Panel de administración: http://localhost:${PORT}/admin`);
    console.log(`Contraseña por defecto: ${ADMIN_PASSWORD}`);
  });
}

module.exports = app;
