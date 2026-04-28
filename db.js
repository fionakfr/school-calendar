const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false });

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      verified INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS magic_links (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      token TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      event_type TEXT NOT NULL CHECK(event_type IN ('available','holiday_camp','playdate','away')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS rsvps (
      id SERIAL PRIMARY KEY,
      event_id INTEGER NOT NULL REFERENCES events(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      response TEXT NOT NULL CHECK(response IN ('yes','no','maybe')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(event_id, user_id)
    );
  `);
}

module.exports = { pool, init };
