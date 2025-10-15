const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const db = require('../../config/database');

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.getAll();
    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's songs
router.get('/user/:userId/songs', async (req, res) => {
  try {
    const { userId } = req.params;

    const songs = await new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM songs WHERE user_id = ? ORDER BY position ASC',
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({ songs });
  } catch (error) {
    console.error('Get user songs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all admin users
router.get('/admin-users', async (req, res) => {
  try {
    console.log('Fetching admin users...');
    const adminUsers = await new Promise((resolve, reject) => {
      db.all('SELECT id, username, created_at FROM admin_users ORDER BY created_at DESC', (err, rows) => {
        if (err) {
          console.error('Database error:', err);
          reject(err);
        } else {
          console.log('Admin users found:', rows);
          resolve(rows);
        }
      });
    });

    console.log('Sending response:', { adminUsers });
    res.json({ adminUsers });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new admin user
router.post('/admin-users', [
  body('username').notEmpty().trim().withMessage('Benutzername ist erforderlich'),
  body('password').isLength({ min: 6 }).withMessage('Passwort muss mindestens 6 Zeichen lang sein')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    // Check if username already exists
    const existingUser = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM admin_users WHERE username = ?', [username], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Benutzername bereits vergeben' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create admin user
    const result = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO admin_users (username, password_hash) VALUES (?, ?)',
        [username, passwordHash],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });

    res.json({ 
      message: 'Admin-Benutzer erfolgreich erstellt', 
      user: { id: result.id, username } 
    });
  } catch (error) {
    console.error('Error creating admin user:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete admin user
router.delete('/admin-users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id;

    // Prevent deleting own account
    if (parseInt(id) === currentUserId) {
      return res.status(400).json({ message: 'Du kannst deinen eigenen Account nicht löschen' });
    }

    // Check if user exists
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT id, username FROM admin_users WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      return res.status(404).json({ message: 'Admin-Benutzer nicht gefunden' });
    }

    // Delete user
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM admin_users WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ message: `Admin-Benutzer "${user.username}" erfolgreich gelöscht` });
  } catch (error) {
    console.error('Error deleting admin user:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
