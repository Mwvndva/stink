const { Pool } = require('pg');
require('dotenv').config();

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

async function initDatabase() {
  try {
    console.log('Creating database tables...');

    // Create users table
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        phone_number VARCHAR(20) PRIMARY KEY,
        name VARCHAR(100),
        gender VARCHAR(10),
        age_bracket VARCHAR(20),
        activated BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create chat_history table
    await db.query(`
      CREATE TABLE IF NOT EXISTS chat_history (
        id SERIAL PRIMARY KEY,
        phone_number VARCHAR(20) REFERENCES users(phone_number),
        message TEXT,
        is_bot BOOLEAN,
        mood VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create suggestions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS suggestions (
        id SERIAL PRIMARY KEY,
        phone_number VARCHAR(20) REFERENCES users(phone_number),
        mood VARCHAR(20),
        suggestion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Database tables created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating database tables:', error);
    process.exit(1);
  }
}

initDatabase(); 