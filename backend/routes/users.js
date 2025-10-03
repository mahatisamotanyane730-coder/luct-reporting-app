const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../config/db');

// GET recipients for reports - FIXED: PRL can see ALL PLs regardless of stream
router.get('/recipients', auth, (req, res) => {
  const userRole = req.user.role;
  const userStream = req.user.stream;
  
  console.log('👤 Fetching recipients for user:', {
    id: req.user.id,
    role: userRole,
    stream: userStream
  });

  let query = '';
  let params = [];

  // Determine who can receive reports based on current user's role
  if (userRole === 'student') {
    // Students can send to PRLs from ALL streams
    query = `SELECT id, username as name, email, role, stream 
             FROM users 
             WHERE role = 'prl' 
             ORDER BY stream, username`;
    
  } else if (userRole === 'lecturer') {
    // Lecturers can send to PRLs from ALL streams  
    query = `SELECT id, username as name, email, role, stream 
             FROM users 
             WHERE role = 'prl' 
             ORDER BY stream, username`;
    
  } else if (userRole === 'prl') {
    // ✅ FIXED: PRLs can send to PLs from ALL streams (removed stream filter)
    query = `SELECT id, username as name, email, role, stream 
             FROM users 
             WHERE role = 'pl' 
             ORDER BY stream, username`;
    // No params needed - removed stream filtering
    
  } else if (userRole === 'pl') {
    // PLs can send to FMG
    query = `SELECT id, username as name, email, role, stream 
             FROM users 
             WHERE role = 'fmg' 
             ORDER BY username`;
    
  } else {
    // FMG can send to anyone
    query = `SELECT id, username as name, email, role, stream 
             FROM users 
             WHERE role IN ('prl', 'pl', 'fmg') 
             ORDER BY role, stream, username`;
  }

  console.log('📋 Executing query:', query);
  console.log('🔢 With params:', params);

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('❌ Database error fetching recipients:', err);
      return res.status(500).json({ 
        msg: 'Failed to fetch recipients',
        error: err.message 
      });
    }
    
    console.log(`✅ Found ${results.rows.length} recipients for ${userRole} user`);
    
    // If no recipients found, provide helpful debug info
    if (results.rows.length === 0) {
      console.log('⚠️ No recipients found for role:', userRole);
      
      let errorMsg = '';
      if (userRole === 'prl') {
        errorMsg = 'No Program Leaders (PLs) available. Please contact administrator to create PL accounts.';
      } else if (userRole === 'pl') {
        errorMsg = 'No Faculty Management (FMG) available. Please contact administrator.';
      } else {
        errorMsg = 'No recipients available. Please contact administrator.';
      }
      
      return res.status(404).json({ 
        msg: errorMsg,
        debug: {
          userRole,
          userStream,
          query: query,
          params: params
        }
      });
    }
    
    console.log('📨 Available recipients:', results.rows.map(r => `${r.name} (${r.role}, ${r.stream})`));
    res.json(results.rows);
  });
});

module.exports = router;