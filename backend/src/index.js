// Load environment variables first
const dotenv = require('dotenv');
dotenv.config();

// Then validate environment variables
const validateEnv = require('./validate-env');
validateEnv();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth.routes');
const organizationRoutes = require('./routes/organization.routes');

// Create Express app
const app = express();

// Simple health check endpoint that doesn't require database access
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    env: {
      nodeEnv: process.env.NODE_ENV,
      dbConfigured: !!process.env.DB_HOST,
      dbHost: process.env.DB_HOST ? process.env.DB_HOST.substring(0, 5) + '...' : null,
      dbName: process.env.DB_NAME
    }
  });
});

// Database test endpoint
app.get('/api/v1/db-test', async (req, res) => {
  try {
    console.log('Database test endpoint called');
    const db = require('./db');
    const result = await db.raw('SELECT 1 as test');
    
    // Get pool information if available
    let poolInfo = {};
    if (db.client && db.client.pool) {
      const pool = db.client.pool;
      poolInfo = {
        min: pool.min,
        max: pool.max,
        numUsed: pool.numUsed ? pool.numUsed() : 'N/A',
        numFree: pool.numFree ? pool.numFree() : 'N/A',
        numPendingAcquires: pool.numPendingAcquires ? pool.numPendingAcquires() : 'N/A',
        numPendingCreates: pool.numPendingCreates ? pool.numPendingCreates() : 'N/A'
      };
    }
    
    res.json({ 
      success: true, 
      result,
      connectionPool: poolInfo,
      environment: process.env.NODE_ENV,
      dbHost: process.env.DB_HOST ? process.env.DB_HOST.substring(0, 5) + '...' : null,
      dbName: process.env.DB_NAME,
      timestamp: new Date().toISOString()
    });
    
    console.log('Database test successful');
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://*"]
    }
  }
})); // Security headers with CSP configured for React

app.use(cors({
  origin: [
    'https://kjjicorx.manus.space', 
    'http://localhost:3001',
    'https://cloud-accounting-app-frontend-hkauh.ondigitalocean.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
})); // Enable CORS with specific origins

app.use(express.json()); // Parse JSON bodies
app.use(morgan('dev')); // HTTP request logging

// API routes - Only mount the essential routes for now
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/organizations', organizationRoutes);

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../../frontend/build')));

// Root API route
app.get('/api', (req, res) => {
  res.json({
    message: 'Welcome to the Cloud Accounting API',
    version: '1.0.0',
    documentation: '/api-docs'
  });
});

// The "catchall" handler: for any request that doesn't match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/build/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Handle database connection errors
  if (
    err.code === 'ECONNREFUSED' || 
    err.message.includes('timeout') || 
    err.message.includes('pool') ||
    err.message.includes('connection')
  ) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Database service is currently unavailable. Please try again later.',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      }
    });
  }
  
  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: err.details
      }
    });
  }
  
  // Handle other errors
  res.status(500).json({
    success: false,
    error: {
      code: 'SERVER_ERROR',
      message: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
