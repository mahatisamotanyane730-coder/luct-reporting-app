const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../config/db');
const XLSX = require('xlsx');

console.log('✅ reports.js loaded successfully!');

// ========== SUBMIT REPORT ENDPOINT ==========
router.post('/submit', auth, async (req, res) => {
  console.log('📨 Received report submission from:', req.user.role);
  console.log('📊 Report data:', req.body);
  
  try {
    let { type, recipient_id, recipient_role, ...data } = req.body;
    data.sender_id = req.user.id;
    
    // Set recipient and type based on user role - ✅ FIXED TYPE VALUES
    if (req.user.role === 'student') {
      data.recipient_id = recipient_id;
      // ✅ FIXED: Use only allowed types for students
      data.type = 'student_activity'; // Force to allowed type
      data.stream = req.user.stream;
      console.log('🎓 Student report type set to: student_activity');
    } else if (req.user.role === 'lecturer') {
      data.recipient_id = recipient_id || req.user.id;
      data.type = 'lecture'; // This should be allowed
      data.stream = req.user.stream;
    } else if (req.user.role === 'prl') {
      // ✅ FIXED: PRL sends to PL with specific type
      data.recipient_id = recipient_id;
      data.type = 'lecture'; // Use existing allowed type instead of 'prl_to_pl'
      data.stream = req.user.stream;
      console.log('🔁 PRL setting report type to: lecture');
    } else if (req.user.role === 'pl') {
      // PL sends to FMG
      data.recipient_id = recipient_id;
      data.type = 'lecture'; // Use existing allowed type
      data.stream = req.user.stream;
    } else {
      data.recipient_id = recipient_id || req.user.id;
      data.type = 'lecture'; // Default to allowed type
    }

    console.log('🔍 Final data before mapping:', data);
    
    // Field mapping with data cleaning
    const fieldMapping = {
      // Basic information
      faculty_name: 'faculty_name',
      class_name: 'class_name',
      week: 'week_of_reporting',
      date: 'date_of_lecture',
      course_name: 'course_name',
      code: 'course_code',
      lecturer_name: 'lecturer_name',
      
      // Attendance & venue
      present_students: 'actual_students_present',
      total_students: 'total_registered_students',
      venue: 'venue',
      time: 'scheduled_time',
      
      // Teaching content
      topic: 'topic_taught',
      outcomes: 'learning_outcomes',
      recommendations: 'lecturer_recommendations',
      
      // Additional fields
      content: 'content',
      priority: 'priority',
      teaching_method: 'teaching_method',
      materials_used: 'materials_used',
      challenges: 'challenges',
      
      // System fields
      type: 'type',
      recipient_id: 'recipient_id',
      sender_id: 'sender_id',
      stream: 'stream'
    };

    // Create database-ready object with data cleaning
    const dbData = {};
    Object.keys(data).forEach(key => {
      if (fieldMapping[key] && data[key] !== undefined && data[key] !== null) {
        // Convert empty strings to NULL for database
        let value = data[key];
        
        // Handle empty strings for integer fields
        if (value === '' && [
          'actual_students_present', 
          'total_registered_students',
          'recipient_id',
          'sender_id'
        ].includes(fieldMapping[key])) {
          value = null;
        }
        
        // Convert string numbers to actual integers
        if ([
          'actual_students_present', 
          'total_registered_students',
          'recipient_id',
          'sender_id'
        ].includes(fieldMapping[key]) && value !== null) {
          value = parseInt(value) || null;
        }
        
        dbData[fieldMapping[key]] = value;
      }
    });

    // ✅ FIXED: Ensure type is always set to an allowed value
    if (!dbData.type) {
      dbData.type = 'lecture'; // Default to allowed type
      console.log('🔄 Setting default type to: lecture');
    } else {
      // ✅ FIXED: Validate and force allowed types
      const allowedTypes = ['lecture', 'student_activity']; // Add other allowed types here
      if (!allowedTypes.includes(dbData.type)) {
        console.log('⚠️ Invalid type detected, forcing to: lecture');
        dbData.type = 'lecture';
      }
    }

    // Add required system fields
    if (!dbData.created_at) {
      dbData.created_at = new Date();
    }
    if (!dbData.status) {
      dbData.status = 'submitted';
    }

    // Remove any fields that are still empty strings or invalid
    Object.keys(dbData).forEach(key => {
      if (dbData[key] === '' || dbData[key] === undefined) {
        delete dbData[key];
      }
    });

    const fields = Object.keys(dbData);
    const values = Object.values(dbData);
    
    if (fields.length === 0) {
      return res.status(400).json({ msg: 'No valid data to insert' });
    }

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    console.log('🗄️ Inserting into reports with fields:', fields);
    console.log('📋 Values:', values);
    console.log('🔑 Type field value:', dbData.type);

    db.query(
      `INSERT INTO reports (${fields.join(', ')}) VALUES (${placeholders}) RETURNING id`, 
      values, 
      (err, result) => {
        if (err) {
          console.error('❌ Database error:', err);
          return res.status(500).json({ 
            msg: 'Database insertion failed: ' + err.message,
            detail: 'Check if all data types are correct'
          });
        }
        console.log('✅ Report submitted successfully, ID:', result.rows[0]?.id);
        res.json({ 
          msg: 'Report submitted successfully', 
          id: result.rows[0]?.id || null 
        });
      }
    );

  } catch (error) {
    console.error('❌ Server error in submit endpoint:', error);
    res.status(500).json({ msg: 'Server error: ' + error.message });
  }
});
// ========== VIEW REPORTS ENDPOINT ==========
router.get('/view', auth, (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;
  const stream = req.user.stream;
  
  let query = `
    SELECT r.*, 
           u1.username as lecturer_name,
           u2.username as sender_name,
           f.content as feedback,
           u3.username as feedback_sender_name
    FROM reports r 
    LEFT JOIN users u1 ON r.lecturer_id = u1.id
    LEFT JOIN users u2 ON r.sender_id = u2.id
    LEFT JOIN feedback f ON r.id = f.report_id
    LEFT JOIN users u3 ON f.sender_id = u3.id
    WHERE (r.recipient_id = $1 OR r.sender_id = $2)
  `;
  let params = [userId, userId];
  
  if (role === 'student') {
    query += ' AND r.sender_id = $3';
    params.push(userId);
  } else if (role === 'lecturer') {
    query += ' AND r.type = $3 AND r.sender_id = $4 AND r.stream = $5';
    params.push('lecture', userId, stream);
  } else if (role === 'prl') {
    // ✅ FIXED: PRL can see reports sent to them AND reports they sent to PLs
    query += ' AND (r.type IN ($3, $4, $5, $6) OR r.type = $7)';
    params.push('lecture', 'student_activity', 'student_complaint', 'student_suggestion', 'prl_to_pl');
  } else if (role === 'pl') {
    query += ' AND r.type IN ($3, $4) AND r.stream = $5';
    params.push('prl_to_pl', 'pl_to_fmg', stream);
  } else if (role === 'fmg') {
    query += ' AND r.type IN ($3, $4, $5)';
    params.push('prl_to_fmg', 'pl_to_fmg', 'fmg_report');
  } else {
    return res.status(403).json({ msg: 'Unauthorized' });
  }
  
  query += ' ORDER BY r.created_at DESC';
  
  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ msg: err.message });
    res.json(results.rows);
  });
});

// ========== SEARCH REPORTS ENDPOINT ==========
router.get('/search', auth, (req, res) => {
  const { q } = req.query;
  db.query(
    `SELECT r.*, u.username as lecturer_name 
     FROM reports r 
     LEFT JOIN users u ON r.sender_id = u.id 
     WHERE (r.content LIKE $1 OR r.topic LIKE $2 OR r.course_name LIKE $3) 
     AND (r.recipient_id = $4 OR r.sender_id = $5)`,
    [`%${q}%`, `%${q}%`, `%${q}%`, req.user.id, req.user.id],
    (err, results) => {
      if (err) return res.status(500).json({ msg: err.message });
      res.json(results.rows);
    }
  );
});

// ========== DOWNLOAD REPORT ENDPOINT ==========
router.get('/download/:id', auth, (req, res) => {
  db.query(
    'SELECT * FROM reports WHERE id = $1 AND (recipient_id = $2 OR sender_id = $3)',
    [req.params.id, req.user.id, req.user.id],
    (err, results) => {
      if (err || results.rows.length === 0) return res.status(404).json({ msg: 'Report not found' });
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(results.rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Report');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', `attachment; filename=report_${req.params.id}.xlsx`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buf);
    }
  );
});

// ========== MONITORING ENDPOINT ==========
router.get('/monitoring/:userId', auth, (req, res) => {
  const userId = req.params.userId;
  
  db.query(
    `SELECT r.*, 
            u1.username as lecturer_name,
            u2.username as sender_name
     FROM reports r 
     LEFT JOIN users u1 ON r.lecturer_id = u1.id
     LEFT JOIN users u2 ON r.sender_id = u2.id
     WHERE r.recipient_id = $1 OR r.sender_id = $2 
     ORDER BY r.created_at DESC`,
    [userId, userId],
    (err, results) => {
      if (err) return res.status(500).json({ msg: err.message });
      res.json(results.rows);
    }
  );
});

// ========== EXPORT EXCEL ENDPOINT ==========
router.get('/export/excel', auth, (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;
  
  let query = `
    SELECT r.*, u.username as sender_name 
    FROM reports r 
    LEFT JOIN users u ON r.sender_id = u.id 
    WHERE (r.recipient_id = $1 OR r.sender_id = $2)
  `;
  let params = [userId, userId];
  
  if (role === 'student') {
    query += ' AND r.sender_id = $3';
    params.push(userId);
  } else if (role === 'lecturer') {
    query += ' AND r.type = $3 AND r.sender_id = $4 AND r.stream = $5';
    params.push('lecture', userId, req.user.stream);
  } else if (role === 'prl') {
    query += ' AND r.type IN ($3, $4, $5, $6)';
    params.push('lecture', 'student_activity', 'student_complaint', 'student_suggestion');
  } else if (role === 'pl') {
    query += ' AND r.type IN ($3, $4) AND r.stream = $5';
    params.push('prl_to_pl', 'pl_to_fmg', req.user.stream);
  } else if (role === 'fmg') {
    query += ' AND r.type IN ($3, $4, $5)';
    params.push('prl_to_fmg', 'pl_to_fmg', 'fmg_report');
  } else {
    return res.status(403).json({ msg: 'Unauthorized' });
  }
  
  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ msg: err.message });
    
    // Convert to Excel
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(results.rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Reports');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Disposition', 'attachment; filename=reports_export.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  });
});

// ========== REVIEW REPORT ENDPOINT ==========
router.post('/review/:reportId', auth, (req, res) => {
  const reportId = req.params.reportId;
  const { reviewer_id } = req.body;
  
  db.query(
    'UPDATE reports SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3',
    ['reviewed', reviewer_id, reportId],
    (err, result) => {
      if (err) return res.status(500).json({ msg: err.message });
      res.json({ message: 'Report reviewed successfully' });
    }
  );
});

module.exports = router;