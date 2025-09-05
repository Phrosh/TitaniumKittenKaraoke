const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');

const router = express.Router();

// Admin login
router.post('/login', [
  body('username').notEmpty().trim(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    // Check if admin user exists
    const admin = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM admin_users WHERE username = ?',
        [username],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: admin.id, username: admin.username }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Initialize admin user (only if no admin exists)
router.post('/init-admin', [
  body('username').notEmpty().trim(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    // Check if any admin exists
    const adminExists = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM admin_users', (err, row) => {
        if (err) reject(err);
        else resolve(row.count > 0);
      });
    });

    if (adminExists) {
      return res.status(400).json({ message: 'Admin user already exists' });
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

    res.json({ message: 'Admin user created successfully', id: result.id });
  } catch (error) {
    console.error('Init admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify token middleware
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = { router, verifyToken };