module.exports = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    connectionTimeout: 60000,
    // Add statement timeout to prevent long-running queries
    statement_timeout: 30000
  },
  pool: {
    min: 0,  // Start with no connections
    max: 5,  // Reduce maximum connections
    acquireTimeoutMillis: 60000,  // Increase timeout to 60 seconds
    createTimeoutMillis: 60000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 100,
    // Add propagateCreateError setting
    propagateCreateError: false
  },
  // Add query logging in development
  debug: process.env.NODE_ENV === 'development'
};
