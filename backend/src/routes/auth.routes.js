const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const db = require('../db');
const authenticate = require('../middleware/authenticate');

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  phone: Joi.string().allow('', null)
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Validation middleware
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error.details
        }
      });
    }
    next();
  };
};

// Register a new user
router.post('/register', validate(registerSchema), async (req, res, next) => {
  // Initialize transaction variable
  let trx;
  
  try {
    // Create a transaction
    trx = await db.transaction();
    const { email, password, firstName, lastName, phone } = req.body;
    
    // Check if user already exists
    const existingUser = await trx('users').where({ email }).first();
    if (existingUser) {
      await trx.rollback();
      return res.status(409).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'A user with this email already exists'
        }
      });
    }
    
    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Create user
    const [userId] = await trx('users').insert({
      email,
      password_hash: passwordHash,
      first_name: firstName,
      last_name: lastName,
      phone,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    }).returning('id');
    
    // Get created user
    const user = await trx('users')
      .where({ id: userId })
      .select('id', 'email', 'first_name', 'last_name', 'created_at')
      .first();
    
    // Commit transaction
    await trx.commit();
    
    // Send response
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    // Rollback transaction on error if it exists
    if (trx) await trx.rollback();
    
    // Log detailed error information
    console.error('Registration error:', error);
    
    // Pass to error middleware
    next(error);
  }
});

// Login user
router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await db('users')
      .where({ email })
      .select('id', 'email', 'password_hash', 'first_name', 'last_name', 'is_active')
      .first();
    
    // Check if user exists and is active
    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
    }
    
    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    
    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );
    
    // Send response
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
});

// Get current user
router.get('/me', authenticate, async (req, res, next) => {
  try {
    // Get user from database
    const user = await db('users')
      .where({ id: req.userId })
      .select('id', 'email', 'first_name', 'last_name')
      .first();
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }
    
    // Get user organizations
    const organizations = await db('user_organizations')
      .join('organizations', 'user_organizations.organization_id', 'organizations.id')
      .where('user_organizations.user_id', req.userId)
      .select('organizations.id', 'organizations.name', 'user_organizations.role');
    
    // Send response
    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        organizations
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    next(error);
  }
});

module.exports = router;
