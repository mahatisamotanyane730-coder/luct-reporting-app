const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: 5432
});

pool.connect((err, client, done) => {
  if (err) {
    console.error('Database connection failed:', err.message, err.stack);
    throw err;
  }
  console.log('PostgreSQL Connected');
  done();
});

module.exports = pool;