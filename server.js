const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { pool, init } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(async (req, res, next) => {
  const token = req.cookies?.session;
  if (token) {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM sessions WHERE token = $1 AND expires_at > NOW()',
        [token]
      );
      if (rows[0]) {
        const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [rows[0].user_id]);
        req.user = userRes.rows[0];
      }
    } catch (err) {
      // session lookup failed — continue unauthenticated
    }
  }
  next();
});

app.use('/auth', require('./routes/auth'));

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

app.use('/api/events', requireAuth, require('./routes/events'));

app.get('/app', (req, res) => {
  if (!req.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.get('/', (req, res) => {
  if (req.user) return res.redirect('/app');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

init().then(() => {
  app.listen(PORT, () => console.log(`School Calendar running on port ${PORT}`));
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});
