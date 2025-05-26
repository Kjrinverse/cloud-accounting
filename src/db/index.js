// Database connection setup
const knex = require('knex');
const config = require('../config/database');

// Determine environment
const environment = process.env.NODE_ENV || 'development';
console.log(`Initializing database connection for environment: ${environment}`);

// Get connection configuration
const connectionConfig = config[environment];
console.log(`Database host: ${connectionConfig.connection.host}`);

// Initialize database connection
const db = knex(connectionConfig);

// Add event listeners for connection issues
db.on('query-error', (error, query) => {
  console.error('Database query error:', error);
  console.error('Query that caused error:', query.sql);
});

// Test connection on startup
db.raw('SELECT 1')
  .then(() => {
    console.log('Database connection established successfully');
  })
  .catch(error => {
    console.error('Failed to establish database connection:', error);
  });

module.exports = db;
