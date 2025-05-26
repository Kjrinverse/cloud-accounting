// Authorization middleware
const db = require('../db');

/**
 * Middleware to check if user has required permissions for an organization
 * @param {string[]} requiredPermissions - Array of permission strings required for the route
 */
const authorize = (requiredPermissions = []) => {
  return async (req, res, next) => {
    try {
      const orgId = parseInt(req.params.orgId);
      
      if (!orgId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Organization ID is required'
          }
        });
      }
      
      // Check if user has access to this organization
      const userOrg = req.user.organizations.find(org => org.id === orgId);
      
      if (!userOrg) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have access to this organization'
          }
        });
      }
      
      // If no specific permissions are required, just check organization access
      if (!requiredPermissions.length) {
        return next();
      }
      
      // Check if user has all required permissions
      const hasAllPermissions = requiredPermissions.every(permission => 
        userOrg.permissions.includes(permission) || userOrg.permissions.includes('admin')
      );
      
      if (!hasAllPermissions) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have the required permissions for this action'
          }
        });
      }
      
      // Add organization to request for convenience
      req.organization = {
        id: userOrg.id,
        name: userOrg.name,
        taxId: userOrg.taxId,
        baseCurrency: userOrg.baseCurrency,
        userRole: userOrg.role,
        userPermissions: userOrg.permissions
      };
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = authorize;
