const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../config/db');

console.log('✅ ratings.js loaded successfully!');

// ========== GET ALL USERS FOR RATING ==========
router.get('/ratees', auth, (req, res) => {
  const userRole = req.user.role;
  
  console.log('⭐ Fetching ratees for user role:', userRole);

  let allowedRoles = [];
  
  switch (userRole) {
    case 'student':
      allowedRoles = ['lecturer', 'prl', 'pl', 'fmg'];
      break;
    case 'lecturer':
      allowedRoles = ['prl', 'pl', 'fmg'];
      break;
    case 'prl':
      allowedRoles = ['pl', 'fmg'];
      break;
    case 'pl':
      allowedRoles = ['fmg'];
      break;
    default:
      allowedRoles = [];
  }

  if (allowedRoles.length === 0) {
    return res.json([]);
  }

  const placeholders = allowedRoles.map((_, index) => `$${index + 1}`).join(',');
  
  const query = `
    SELECT id, username as name, email, role, stream 
    FROM users 
    WHERE role IN (${placeholders})
    ORDER BY role, stream, username
  `;

  db.query(query, allowedRoles, (err, results) => {
    if (err) {
      console.error('❌ Database error fetching ratees:', err);
      return res.status(500).json({ 
        msg: 'Failed to fetch rating options',
        error: err.message 
      });
    }
    
    console.log(`✅ Found ${results.rows.length} ratees for ${userRole}`);
    res.json(results.rows);
  });
});

// ========== SUBMIT RATING ENDPOINT (FIXED) ==========
router.post('/submit', auth, (req, res) => {
  const { ratee_id, recipient_id, score, comment, category, rater_id, rater_role } = req.body;
  
  // Use the user from auth if rater info not provided
  const finalRaterId = rater_id || req.user.id;
  const finalRaterRole = rater_role || req.user.role;

  console.log('⭐ Rating submission from:', {
    rater_id: finalRaterId,
    rater_role: finalRaterRole,
    ratee_id,
    recipient_id,
    score,
    category
  });

  // Validate required fields
  if (!ratee_id || !score || !comment) {
    return res.status(400).json({ 
      msg: 'Ratee ID, score, and comment are required' 
    });
  }

  // For students and lecturers, recipient_id is required
  if (['student', 'lecturer'].includes(finalRaterRole) && !recipient_id) {
    return res.status(400).json({ 
      msg: 'PRL recipient is required for students and lecturers' 
    });
  }

  // Determine recipient based on rater's role if not provided
  let finalRecipientId = recipient_id;

  if (!finalRecipientId) {
    if (finalRaterRole === 'prl') {
      // PRL sends to PL - find any PL
      const plQuery = `SELECT id FROM users WHERE role = 'pl' LIMIT 1`;
      db.query(plQuery, [], (err, result) => {
        if (err || result.rows.length === 0) {
          console.error('❌ No PL found for PRL rating');
          return res.status(404).json({ msg: 'No Program Leader available to receive rating' });
        }
        finalRecipientId = result.rows[0].id;
        insertRating(finalRecipientId);
      });
      return; // Return early since we're handling this asynchronously
    } else if (finalRaterRole === 'pl') {
      // PL sends to FMG - find any FMG
      const fmgQuery = `SELECT id FROM users WHERE role = 'fmg' LIMIT 1`;
      db.query(fmgQuery, [], (err, result) => {
        if (err || result.rows.length === 0) {
          console.error('❌ No FMG found for PL rating');
          return res.status(404).json({ msg: 'No Faculty Management available to receive rating' });
        }
        finalRecipientId = result.rows[0].id;
        insertRating(finalRecipientId);
      });
      return; // Return early since we're handling this asynchronously
    }
  }

  // For students/lecturers (with recipient_id) or other cases
  insertRating(finalRecipientId);

  function insertRating(recipientId) {
    const query = `
      INSERT INTO ratings (rater_id, ratee_id, recipient_id, score, comment, category, rater_role, created_at) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) 
      RETURNING id
    `;
    
    const values = [
      finalRaterId,
      ratee_id,
      recipientId,
      score,
      comment,
      category || 'teaching',
      finalRaterRole
    ];

    console.log('🗄️ Inserting rating with values:', values);

    db.query(query, values, (err, result) => {
      if (err) {
        console.error('❌ Database error submitting rating:', err);
        return res.status(500).json({ 
          msg: 'Failed to submit rating: ' + err.message 
        });
      }

      console.log('✅ Rating submitted successfully, ID:', result.rows[0].id);
      res.json({ 
        msg: 'Rating submitted successfully',
        id: result.rows[0].id
      });
    });
  }
});

// ========== VIEW RATINGS ENDPOINT (IMPROVED) ==========
router.get('/view', auth, (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;

  console.log('📊 Fetching ratings for:', role, userId);

  let query = `
    SELECT r.*, 
           u1.username as rater_name,
           u1.role as rater_role,
           u2.username as ratee_name,
           u2.role as ratee_role,
           u3.username as recipient_name,
           u3.role as recipient_role
    FROM ratings r
    LEFT JOIN users u1 ON r.rater_id = u1.id
    LEFT JOIN users u2 ON r.ratee_id = u2.id
    LEFT JOIN users u3 ON r.recipient_id = u3.id
    WHERE 1=1
  `;
  
  let params = [];
  let paramCount = 0;

  // Filter based on user role
  if (role === 'student') {
    // Students see ratings they submitted
    query += ` AND r.rater_id = $${++paramCount}`;
    params.push(userId);
  } else if (role === 'lecturer') {
    // Lecturers see ratings they submitted
    query += ` AND r.rater_id = $${++paramCount}`;
    params.push(userId);
  } else if (role === 'prl') {
    // PRLs see ratings where they are the recipient OR they are the ratee
    query += ` AND (r.recipient_id = $${++paramCount} OR r.ratee_id = $${++paramCount})`;
    params.push(userId, userId);
  } else if (role === 'pl') {
    // PLs see ratings where they are the recipient OR they are the ratee
    query += ` AND (r.recipient_id = $${++paramCount} OR r.ratee_id = $${++paramCount})`;
    params.push(userId, userId);
  } else if (role === 'fmg') {
    // FMG sees ratings where they are the recipient OR they are the ratee
    query += ` AND (r.recipient_id = $${++paramCount} OR r.ratee_id = $${++paramCount})`;
    params.push(userId, userId);
  }

  query += ' ORDER BY r.created_at DESC';

  console.log('📋 Executing ratings query:', query);
  console.log('🔢 With params:', params);

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('❌ Error fetching ratings:', err);
      return res.status(500).json({ msg: 'Failed to fetch ratings: ' + err.message });
    }
    
    console.log(`✅ Found ${results.rows.length} ratings for ${role}`);
    res.json(results.rows);
  });
});

// ========== GET RATINGS RECEIVED BY USER ==========
router.get('/received', auth, (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;

  console.log('📥 Fetching ratings received by:', role, userId);

  const query = `
    SELECT r.*, 
           u1.username as rater_name,
           u1.role as rater_role,
           u2.username as ratee_name,
           u2.role as ratee_role
    FROM ratings r
    LEFT JOIN users u1 ON r.rater_id = u1.id
    LEFT JOIN users u2 ON r.ratee_id = u2.id
    WHERE r.recipient_id = $1
    ORDER BY r.created_at DESC
  `;

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('❌ Error fetching received ratings:', err);
      return res.status(500).json({ msg: 'Failed to fetch received ratings: ' + err.message });
    }
    
    console.log(`✅ Found ${results.rows.length} ratings received by ${role}`);
    res.json(results.rows);
  });
});

module.exports = router;