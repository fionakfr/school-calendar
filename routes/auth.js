const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db');
const { sendMagicLink } = require('../mailer');

router.post('/request-link', async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    let { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    let user = rows[0];

    if (!user) {
      if (!name || name.trim().length < 2) {
        return res.status(400).json({ needsName: true, message: 'Please provide your name to register' });
      }
      const ins = await pool.query(
        'INSERT INTO users (email, name, verified) VALUES ($1, $2, 1) RETURNING *',
        [email, name.trim()]
      );
      user = ins.rows[0];
    }

    await pool.query('DELETE FROM magic_links WHERE email = $1', [email]);

    const token = uuidv4();
    const expires = new Date(Date.now() + 30 * 60 * 1000);
    await pool.query(
      'INSERT INTO magic_links (email, token, expires_at) VALUES ($1, $2, $3)',
      [email, token, expires]
    );

    try {
      await sendMagicLink(email, user.name || email, token);
      res.json({ message: 'Magic link sent! Check your email.' });
    } catch (err) {
      console.error('Email error:', err.message);
      if (process.env.NODE_ENV !== 'production') {
        res.json({ message: 'Email not configured — dev token below', devToken: token });
      } else {
        res.status(500).json({ error: 'Failed to send email. Check server SMTP config.' });
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/verify/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { rows } = await pool.query(
      'SELECT * FROM magic_links WHERE token = $1 AND used = 0 AND expires_at > NOW()',
      [token]
    );
    const link = rows[0];
    if (!link) return res.redirect('/?error=invalid-link');

    await pool.query('UPDATE magic_links SET used = 1 WHERE token = $1', [token]);

    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [link.email]);
    const user = userRes.rows[0];
    if (!user) return res.redirect('/?error=user-not-found');

    await pool.query('UPDATE users SET verified = 1 WHERE id = $1', [user.id]);

    const sessionToken = uuidv4();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, sessionToken, expires]
    );

    res.cookie('session', sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === 'production'
    });

    res.redirect('/app');
  } catch (err) {
    console.error(err);
    res.redirect('/?error=invalid-link');
  }
});

router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ id: req.user.id, email: req.user.email, name: req.user.name });
});

router.post('/logout', async (req, res) => {
  const token = req.cookies?.session;
  if (token) await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
  res.clearCookie('session');
  res.json({ message: 'Logged out' });
});

module.exports = router;
