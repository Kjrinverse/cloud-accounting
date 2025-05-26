// Database connection setup
const knex = require('knex');
const config = require('../config/database');

// Get the environment from process.env.NODE_ENV or default to development
const environment = process.env.NODE_ENV || 'development';
const connectionConfig = config[environment];

// Initialize the database connection with error handling
let db;
try {
  console.log(`Initializing database connection for environment: ${environment}`);
  console.log(`Database host: ${connectionConfig.connection.host}`);
  
  db = knex(connectionConfig);
  
  // Test the connection
  db.raw('SELECT 1')
    .then(() => {
      console.log('Database connection established successfully');
    })
    .catch(err => {
      console.error('Error testing database connection:', err);
    });
} catch (error) {
  console.error('Failed to initialize database connection:', error);
  // Initialize with a dummy connection that will log errors instead of crashing
  db = knex({
    client: 'postgresql',
    connection: () => {
      console.error('Attempted to use database with failed initialization');
      throw new Error('Database connection failed to initialize');
    }
  });
}

// Add event listeners for connection issues
db.on('query-error', (error, query) => {
  console.error('Database query error:', error, query);
});

module.exports = db;

