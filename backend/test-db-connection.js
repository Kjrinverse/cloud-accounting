require('dotenv' ).config();
const knex = require('knex')({
  client: process.env.DB_CLIENT || 'pg',
  connection: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? true : false
  }
});

async function testConnection() {
  try {
    console.log('Testing database connection...');
    console.log('Connection config:', {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === 'true'
    });
    
    // Try a simple query
    const result = await knex.raw('SELECT 1+1 AS result');
    console.log('Connection successful!', result);
    process.exit(0);
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}

testConnection();
