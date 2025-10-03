const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../config/db');

// Add course (PRL/PL only)
router.post('/add', auth, (req, res) => {
  if (!['prl', 'pl'].includes(req.user.role)) {
    return res.status(403).json({ msg: 'Unauthorized - Only PRL and PL can add courses' });
  }
  
  const { name, code, stream } = req.body;
  
  if (!name || !code || !stream) {
    return res.status(400).json({ msg: 'Course name, code, and stream are required' });
  }

  // Check if course code already exists
  db.query(
    'SELECT id FROM courses WHERE code = $1',
    [code],
    (err, result) => {
      if (err) return res.status(500).json({ msg: err.message });
      
      if (result.rows.length > 0) {
        return res.status(400).json({ msg: 'Course code already exists' });
      }

      // ✅ FIXED: Only use columns that exist in your database
      db.query(
        `INSERT INTO courses (name, code, stream) 
         VALUES ($1, $2, $3) RETURNING id`,
        [name, code, stream],
        (err, result) => {
          if (err) {
            console.error('❌ Database insert error:', err);
            return res.status(500).json({ msg: err.message });
          }
          res.json({ 
            msg: 'Course added successfully', 
            id: result.rows[0].id 
          });
        }
      );
    }
  );
});

// View ALL courses (No filtering - show everything)
router.get('/view', auth, (req, res) => {
  console.log('📚 Fetching ALL courses from database');
  
  // ✅ FIXED: Only select columns that exist in your database
  const query = `
    SELECT id, name, code, stream, pl_id
    FROM courses 
    ORDER BY stream, name
  `;

  console.log('📋 Executing query:', query);

  db.query(query, (err, results) => {
    if (err) {
      console.error('❌ Database error fetching courses:', err);
      return res.status(500).json({ msg: err.message });
    }
    
    console.log(`✅ Found ${results.rows.length} courses in database`);
    console.log('📊 Sample course:', results.rows[0]);
    res.json(results.rows);
  });
});

// Get ALL lecturers from database (No filtering)
router.get('/lecturers', auth, (req, res) => {
  console.log('👨‍🏫 Fetching ALL lecturers from database');
  
  const query = `
    SELECT id, username as name, email, role, stream 
    FROM users 
    WHERE role = 'lecturer' 
    ORDER BY stream, username
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('❌ Database error fetching lecturers:', err);
      return res.status(500).json({ 
        msg: 'Failed to fetch lecturers',
        error: err.message 
      });
    }
    
    console.log(`✅ Found ${results.rows.length} lecturers in database`);
    res.json(results.rows);
  });
});

// Update course (PRL/PL only)
router.put('/update/:id', auth, (req, res) => {
  if (!['prl', 'pl'].includes(req.user.role)) {
    return res.status(403).json({ msg: 'Unauthorized' });
  }
  
  const { name, code, stream } = req.body;
  const courseId = req.params.id;

  console.log('🔄 Updating course:', { courseId, name, code, stream });

  db.query(
    `UPDATE courses SET name = $1, code = $2, stream = $3 
     WHERE id = $4`,
    [name, code, stream, courseId],
    (err, result) => {
      if (err) {
        console.error('❌ Database update error:', err);
        return res.status(500).json({ msg: err.message });
      }
      if (result.rowCount === 0) return res.status(404).json({ msg: 'Course not found' });
      res.json({ msg: 'Course updated successfully' });
    }
  );
});

// Delete course (PRL/PL only)
router.delete('/delete/:id', auth, (req, res) => {
  if (!['prl', 'pl'].includes(req.user.role)) {
    return res.status(403).json({ msg: 'Unauthorized' });
  }
  
  const courseId = req.params.id;

  console.log('🗑️ Deleting course ID:', courseId);

  // Check if course has classes assigned
  db.query(
    'SELECT id FROM classes WHERE course_id = $1 LIMIT 1',
    [courseId],
    (err, result) => {
      if (err) {
        console.error('❌ Database check error:', err);
        return res.status(500).json({ msg: err.message });
      }
      
      if (result.rows.length > 0) {
        return res.status(400).json({ 
          msg: 'Cannot delete course - it has assigned classes. Remove classes first.' 
        });
      }

      db.query(
        'DELETE FROM courses WHERE id = $1',
        [courseId],
        (err, result) => {
          if (err) {
            console.error('❌ Database delete error:', err);
            return res.status(500).json({ msg: err.message });
          }
          if (result.rowCount === 0) return res.status(404).json({ msg: 'Course not found' });
          res.json({ msg: 'Course deleted successfully' });
        }
      );
    }
  );
});

module.exports = router;