const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'karaoke.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

function initializeDatabase() {
  // Users table (for device tracking) - device_id is NOT unique anymore
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Songs table
  db.run(`
    CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      artist TEXT,
      youtube_url TEXT,
      mode TEXT DEFAULT 'youtube',
      status TEXT DEFAULT 'pending',
      position INTEGER DEFAULT 0,
      priority REAL DEFAULT 1.0,
      delay_count INTEGER DEFAULT 0,
      regression_count INTEGER DEFAULT 0,
      duration_seconds INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // Admin users table
  db.run(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Settings table
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, () => {
  // Insert default settings
  db.run(`
    INSERT OR IGNORE INTO settings (key, value) VALUES
    ('max_song_delay', '15'),
    ('current_song_id', '0'),
    ('regression_value', '0.1'),
    ('overlay_title', 'Willkommen beim Karaoke')
  `);

  // Migration: Add mode column to existing songs table
  db.run(`
    ALTER TABLE songs ADD COLUMN mode TEXT DEFAULT 'youtube'
  `, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Migration error:', err);
    }
  });

  // Migration: Add regression_count column to existing songs table
  db.run(`
    ALTER TABLE songs ADD COLUMN regression_count INTEGER DEFAULT 0
  `, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Migration error:', err);
    }
  });
  });
}

module.exports = db;