const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const db = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

async function initDatabase() {
  try {
    const schema = fs.readFileSync('schema.sql', 'utf8');
    await db.query(schema);
    console.log('✅ Database tables created successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Database initialization failed:', err);
    process.exit(1);
  }
}

initDatabase(); 