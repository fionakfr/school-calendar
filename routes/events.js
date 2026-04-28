const express = require('express');
const router = express.Router();
const { pool } = require('../db');

const VALID_TYPES = ['available', 'holiday_camp', 'playdate', 'away'];

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT e.*, u.name as user_name,
        (SELECT COUNT(*) FROM rsvps r WHERE r.event_id = e.id AND r.response = 'yes')::int as rsvp_yes,
        (SELECT COUNT(*) FROM rsvps r WHERE r.event_id = e.id AND r.response = 'maybe')::int as rsvp_maybe,
        (SELECT response FROM rsvps r WHERE r.event_id = e.id AND r.user_id = $1) as my_rsvp
      FROM events e
      JOIN users u ON e.user_id = u.id
      ORDER BY e.start_date ASC
    `, [req.user.id]);

    // Format dates as YYYY-MM-DD strings
    const events = rows.map(e => ({
      ...e,
      start_date: e.start_date.toISOString().slice(0, 10),
      end_date: e.end_date.toISOString().slice(0, 10),
    }));

    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, description, start_date, end_date, event_type } = req.body;

    if (!title || !start_date || !end_date || !event_type) {
      return res.status(400).json({ error: 'title, start_date, end_date, and event_type are required' });
    }
    if (!VALID_TYPES.includes(event_type)) {
      return res.status(400).json({ error: 'Invalid event_type' });
    }
    if (new Date(start_date) > new Date(end_date)) {
      return res.status(400).json({ error: 'start_date must be before end_date' });
    }

    const { rows } = await pool.query(`
      INSERT INTO events (user_id, title, description, start_date, end_date, event_type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [req.user.id, title.trim(), description?.trim() || null, start_date, end_date, event_type]);

    const event = {
      ...rows[0],
      user_name: req.user.name,
      start_date: rows[0].start_date.toISOString().slice(0, 10),
      end_date: rows[0].end_date.toISOString().slice(0, 10),
    };
    res.status(201).json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM events WHERE id = $1', [req.params.id]);
    const event = rows[0];
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.user_id !== req.user.id) return res.status(403).json({ error: 'Not your event' });

    await pool.query('DELETE FROM rsvps WHERE event_id = $1', [event.id]);
    await pool.query('DELETE FROM events WHERE id = $1', [event.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/rsvp', async (req, res) => {
  try {
    const { response } = req.body;
    if (!['yes', 'no', 'maybe'].includes(response)) {
      return res.status(400).json({ error: 'response must be yes, no, or maybe' });
    }

    const { rows } = await pool.query('SELECT * FROM events WHERE id = $1', [req.params.id]);
    const event = rows[0];
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.event_type !== 'playdate') return res.status(400).json({ error: 'Only playdate events accept RSVPs' });

    await pool.query(`
      INSERT INTO rsvps (event_id, user_id, response) VALUES ($1, $2, $3)
      ON CONFLICT (event_id, user_id) DO UPDATE SET response = EXCLUDED.response
    `, [event.id, req.user.id, response]);

    res.json({ message: 'RSVP saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/rsvps', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT r.response, u.name, r.created_at
      FROM rsvps r JOIN users u ON r.user_id = u.id
      WHERE r.event_id = $1
      ORDER BY r.created_at ASC
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
