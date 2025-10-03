const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const dotenv = require('dotenv');
dotenv.config();

// ========================
// REGISTER route
// ========================
router.post('/register', (req, res) => {
  const { username, password, role, stream, email } = req.body;

  // Validate required fields
  if (!username || !password || !role) {
    return res.status(400).json({ msg: 'Please provide all required fields' });
  }

  // Validate stream for relevant roles
  const validStreams = ['IT', 'IS', 'CS', 'SE'];
  if (role !== 'student' && role !== 'lecturer' && stream && !validStreams.includes(stream)) {
    return res.status(400).json({ msg: 'Invalid stream' });
  }

  // Check if username already exists
  db.query('SELECT * FROM users WHERE username = $1', [username], (err, result) => {
    if (err) return res.status(500).json({ msg: err.message });
    if (result.rows.length > 0) {
      return res.status(400).json({ msg: 'Username already exists' });
    }

    // Hash the password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Insert new user into database
    db.query(
      'INSERT INTO users (username, password, role, stream, email) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, role, stream',
      [username, hashedPassword, role, stream, email],
      (err, result) => {
        if (err) return res.status(500).json({ msg: err.message });

        const newUser = result.rows[0];
        res.status(201).json({
          msg: 'User registered successfully',
          user: newUser
        });
      }
    );
  });
});

// ========================
// LOGIN route
// ========================
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Validate fields
  if (!username || !password) {
    return res.status(400).json({ msg: 'Username and password required' });
  }

  // Check if user exists
  db.query('SELECT * FROM users WHERE username = $1', [username], (err, results) => {
    if (err) return res.status(500).json({ msg: err.message });
    if (results.rows.length === 0) return res.status(400).json({ msg: 'User not found' });

    const user = results.rows[0];

    // Compare password
    const isPasswordValid = bcrypt.compareSync(password, user.password);
    if (!isPasswordValid) return res.status(400).json({ msg: 'Invalid credentials' });

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, role: user.role, stream: user.stream },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Return token + user info
    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role, stream: user.stream }
    });
  });
});

module.exports = router;