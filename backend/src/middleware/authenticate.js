// Authentication middleware
const jwt = require('jsonwebtoken');
const db = require('../db');

/**
 * Middleware to authenticate JWT tokens
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user exists
    const user = await db('users')
      .where('id', decoded.userId)
      .select('id', 'email', 'first_name', 'last_name', 'is_active')
      .first();
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not found'
        }
      });
    }
    
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User account is inactive'
        }
      });
    }
    
    // Get user organizations and roles
    const userOrganizations = await db('user_organizations')
      .join('organizations', 'user_organizations.organization_id', 'organizations.id')
      .join('roles', 'user_organizations.role_id', 'roles.id')
      .where('user_organizations.user_id', user.id)
      .select(
        'organizations.id',
        'organizations.name',
        'organizations.tax_id',
        'organizations.base_currency',
        'roles.id as roleId',
        'roles.name as role',
        'roles.permissions'
      );
    
    // Add user and organizations to request object
    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      organizations: userOrganizations.map(org => ({
        id: org.id,
        name: org.name,
        taxId: org.tax_id,
        baseCurrency: org.base_currency,
        roleId: org.roleId,
        role: org.role,
        permissions: org.permissions ? JSON.parse(org.permissions) : []
      }))
    };
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token'
        }
      });
    }
    
    next(error);
  }
};

module.exports = authenticate;
