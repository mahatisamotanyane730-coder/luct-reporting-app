process.on('uncaughtException', err => {
  console.error('Uncaught Exception:', err.message, err.stack);
  process.exit(1);
});

process.on('unhandledRejection', err => {
  console.error('Unhandled Rejection:', err.message, err.stack);
});

process.on('exit', code => {
  if (code !== 0) console.error('Process exited with code:', code);
});

const express = require('express');
const cors = require('cors');
const db = require('./config/db');
const dotenv = require('dotenv');
dotenv.config();

console.log('Starting server...');

const app = express();

app.use(cors());
app.use(express.json());

// Add debug logging for routes
console.log('🔄 Loading routes...');
app.use('/api/auth', require('./routes/auth'));
console.log('✅ Auth routes loaded');
app.use('/api/reports', require('./routes/reports'));
console.log('✅ Reports routes loaded');
app.use('/api/feedback', require('./routes/feedback'));
console.log('✅ Feedback routes loaded');
app.use('/api/ratings', require('./routes/ratings'));
console.log('✅ Ratings routes loaded');
app.use('/api/courses', require('./routes/courses'));
console.log('✅ Courses routes loaded');
app.use('/api/classes', require('./routes/classes'));
console.log('✅ Classes routes loaded');
app.use('/api/users', require('./routes/users'));
console.log('✅ Users routes loaded');

app.get('/', (req, res) => {
  res.send('Backend is running');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Available endpoints:`);
  console.log(`   - POST   /api/reports/submit`);
  console.log(`   - GET    /api/reports/view`);
  console.log(`   - GET    /api/reports/search`);
  console.log(`   - GET    /api/reports/download/:id`);
  console.log(`   - GET    /api/reports/monitoring/:userId`);
  console.log(`   - GET    /api/reports/export/excel`);
  console.log(`   - POST   /api/reports/review/:reportId`);
});