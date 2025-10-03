const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../config/db');

// ✅ SUBMIT FEEDBACK
router.post('/submit', auth, (req, res) => {
  const { report_id, content } = req.body;
  const sender_id = req.user.id;

  if (!report_id || !content) {
    return res.status(400).json({ msg: 'Report ID and content are required' });
  }

  db.query(
    'INSERT INTO feedback (report_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *',
    [report_id, sender_id, content],
    (err, result) => {
      if (err) {
        console.error('Feedback submission error:', err);
        return res.status(500).json({ msg: 'Failed to submit feedback' });
      }
      res.json({ 
        msg: 'Feedback submitted successfully', 
        feedback: result.rows[0] 
      });
    }
  );
});

// ✅ GET FEEDBACK FOR A REPORT
router.get('/report/:reportId', auth, (req, res) => {
  const reportId = req.params.reportId;

  db.query(
    `SELECT f.*, u.username as sender_name, u.role as sender_role
     FROM feedback f 
     LEFT JOIN users u ON f.sender_id = u.id 
     WHERE f.report_id = $1 
     ORDER BY f.created_at DESC`,
    [reportId],
    (err, result) => {
      if (err) {
        console.error('Error fetching feedback:', err);
        return res.status(500).json({ msg: 'Failed to fetch feedback' });
      }
      res.json(result.rows);
    }
  );
});

module.exports = router;