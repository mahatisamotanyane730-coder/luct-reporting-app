const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../config/db');

// Add class (PRL/PL)
router.post('/add', auth, (req, res) => {
  if (!['prl', 'pl'].includes(req.user.role)) {
    return res.status(403).json({ msg: 'Unauthorized - Only PRL and PL can add classes' });
  }
  
  const { name, course_id, venue, scheduled_time, lecturer_id, total_students } = req.body;
  
  if (!name || !course_id || !venue || !scheduled_time || !lecturer_id || !total_students) {
    return res.status(400).json({ msg: 'All fields are required' });
  }

  // ✅ FIXED: Remove day_of_week from INSERT
  db.query(
    `INSERT INTO classes (name, course_id, venue, scheduled_time, lecturer_id, total_students) 
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [name, course_id, venue, scheduled_time, lecturer_id, total_students],
    (err, result) => {
      if (err) {
        console.error('❌ Database error submitting class:', err);
        return res.status(500).json({ 
          msg: 'Failed to assign class: ' + err.message 
        });
      }

      console.log('✅ Class assigned successfully, ID:', result.rows[0].id);
      res.json({ 
        msg: 'Class assigned successfully', 
        id: result.rows[0].id
      });
    }
  );
});

// Update class (PRL/PL)
router.put('/update/:id', auth, (req, res) => {
  if (!['prl', 'pl'].includes(req.user.role)) {
    return res.status(403).json({ msg: 'Unauthorized' });
  }
  
  const { name, venue, scheduled_time, lecturer_id, total_students } = req.body;
  const classId = req.params.id;

  // ✅ FIXED: Remove day_of_week from UPDATE
  db.query(
    `UPDATE classes SET name = $1, venue = $2, scheduled_time = $3, lecturer_id = $4, total_students = $5 
     WHERE id = $6`,
    [name, venue, scheduled_time, lecturer_id, total_students, classId],
    (err, result) => {
      if (err) return res.status(500).json({ msg: err.message });
      if (result.rowCount === 0) return res.status(404).json({ msg: 'Class not found' });
      res.json({ msg: 'Class updated successfully' });
    }
  );
});

// Delete class (PRL/PL)
router.delete('/delete/:id', auth, (req, res) => {
  if (!['prl', 'pl'].includes(req.user.role)) {
    return res.status(403).json({ msg: 'Unauthorized' });
  }
  
  const classId = req.params.id;

  db.query(
    'DELETE FROM classes WHERE id = $1',
    [classId],
    (err, result) => {
      if (err) return res.status(500).json({ msg: err.message });
      if (result.rowCount === 0) return res.status(404).json({ msg: 'Class not found' });
      res.json({ msg: 'Class deleted successfully' });
    }
  );
});

// View ALL classes (No filtering)
router.get('/view', auth, (req, res) => {
  console.log('🏫 Fetching ALL classes from database');

  // ✅ FIXED: Remove day_of_week from SELECT and ORDER BY
  const query = `
    SELECT cl.*, 
           c.name as course_name, c.code as course_code, c.stream as course_stream,
           u.username as lecturer_name, u.email as lecturer_email
    FROM classes cl
    LEFT JOIN courses c ON cl.course_id = c.id
    LEFT JOIN users u ON cl.lecturer_id = u.id
    ORDER BY cl.scheduled_time
  `;

  console.log('📋 Executing query:', query);

  db.query(query, (err, results) => {
    if (err) {
      console.error('❌ Database error fetching classes:', err);
      return res.status(500).json({ msg: err.message });
    }
    
    console.log(`✅ Found ${results.rows.length} classes in database`);
    res.json(results.rows);
  });
});

module.exports = router;