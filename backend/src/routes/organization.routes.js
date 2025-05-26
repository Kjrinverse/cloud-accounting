// Organization routes
const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const Joi = require('joi');

// Apply authentication middleware to all routes
router.use(authenticate);

// Validation schemas
const createOrganizationSchema = Joi.object({
  name: Joi.string().required(),
  taxId: Joi.string().allow('', null),
  address: Joi.string().allow('', null),
  phone: Joi.string().allow('', null),
  email: Joi.string().email().allow('', null),
  website: Joi.string().uri().allow('', null),
  timezone: Joi.string().default('UTC'),
  fiscalYearStart: Joi.date(),
  baseCurrency: Joi.string().length(3).default('USD')
});

const updateOrganizationSchema = Joi.object({
  name: Joi.string(),
  taxId: Joi.string().allow('', null),
  address: Joi.string().allow('', null),
  phone: Joi.string().allow('', null),
  email: Joi.string().email().allow('', null),
  website: Joi.string().uri().allow('', null),
  timezone: Joi.string(),
  fiscalYearStart: Joi.date(),
  baseCurrency: Joi.string().length(3)
});

// Get all organizations for the current user
router.get('/', async (req, res, next) => {
  try {
    const organizations = req.user.organizations;
    
    res.json({
      success: true,
      data: organizations
    });
  } catch (error) {
    next(error);
  }
});

// Create a new organization
router.post('/', validate(createOrganizationSchema), async (req, res, next) => {
  try {
    const { 
      name, taxId, address, phone, email, website, 
      timezone, fiscalYearStart, baseCurrency 
    } = req.body;
    
    // Start a transaction
    const trx = await db.transaction();
    
    try {
      // Create organization
      const [organizationId] = await trx('organizations').insert({
        name,
        tax_id: taxId,
        address,
        phone,
        email,
        website,
        timezone: timezone || 'UTC',
        fiscal_year_start: fiscalYearStart,
        base_currency: baseCurrency || 'USD',
        created_at: new Date(),
        updated_at: new Date()
      }).returning('id');
      
      // Add current user as admin
      await trx('user_organizations').insert({
        user_id: req.user.id,
        organization_id: organizationId,
        role: 'admin',
        created_at: new Date()
      });
      
      // Commit transaction
      await trx.commit();
      
      // Get created organization
      const organization = await db('organizations')
        .where({ id: organizationId })
        .first();
      
      res.status(201).json({
        success: true,
        message: 'Organization created successfully',
        data: {
          id: organization.id,
          name: organization.name,
          taxId: organization.tax_id,
          address: organization.address,
          phone: organization.phone,
          email: organization.email,
          website: organization.website,
          timezone: organization.timezone,
          fiscalYearStart: organization.fiscal_year_start,
          baseCurrency: organization.base_currency,
          createdAt: organization.created_at
        }
      });
    } catch (error) {
      // Rollback transaction on error
      await trx.rollback();
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// Get organization by ID
router.get('/:id', async (req, res, next) => {
  try {
    const organizationId = req.params.id;
    
    // Check if user has access to this organization
    const hasAccess = req.user.organizations.some(org => org.id === parseInt(organizationId));
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this organization'
        }
      });
    }
    
    // Get organization
    const organization = await db('organizations')
      .where({ id: organizationId })
      .first();
    
    if (!organization) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Organization not found'
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        id: organization.id,
        name: organization.name,
        taxId: organization.tax_id,
        address: organization.address,
        phone: organization.phone,
        email: organization.email,
        website: organization.website,
        timezone: organization.timezone,
        fiscalYearStart: organization.fiscal_year_start,
        baseCurrency: organization.base_currency,
        createdAt: organization.created_at,
        updatedAt: organization.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update organization
router.put('/:id', validate(updateOrganizationSchema), async (req, res, next) => {
  try {
    const organizationId = req.params.id;
    
    // Check if user has admin access to this organization
    const userOrg = req.user.organizations.find(org => org.id === parseInt(organizationId));
    if (!userOrg) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this organization'
        }
      });
    }
    
    if (userOrg.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only administrators can update organization details'
        }
      });
    }
    
    // Prepare update data
    const updateData = {};
    const { 
      name, taxId, address, phone, email, website, 
      timezone, fiscalYearStart, baseCurrency 
    } = req.body;
    
    if (name !== undefined) updateData.name = name;
    if (taxId !== undefined) updateData.tax_id = taxId;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (website !== undefined) updateData.website = website;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (fiscalYearStart !== undefined) updateData.fiscal_year_start = fiscalYearStart;
    if (baseCurrency !== undefined) updateData.base_currency = baseCurrency;
    
    updateData.updated_at = new Date();
    
    // Update organization
    await db('organizations')
      .where({ id: organizationId })
      .update(updateData);
    
    // Get updated organization
    const organization = await db('organizations')
      .where({ id: organizationId })
      .first();
    
    res.json({
      success: true,
      message: 'Organization updated successfully',
      data: {
        id: organization.id,
        name: organization.name,
        taxId: organization.tax_id,
        address: organization.address,
        phone: organization.phone,
        email: organization.email,
        website: organization.website,
        timezone: organization.timezone,
        fiscalYearStart: organization.fiscal_year_start,
        baseCurrency: organization.base_currency,
        updatedAt: organization.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get users in organization
router.get('/:id/users', async (req, res, next) => {
  try {
    const organizationId = req.params.id;
    
    // Check if user has access to this organization
    const hasAccess = req.user.organizations.some(org => org.id === parseInt(organizationId));
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this organization'
        }
      });
    }
    
    // Get users
    const users = await db('user_organizations')
      .join('users', 'user_organizations.user_id', 'users.id')
      .where('user_organizations.organization_id', organizationId)
      .select(
        'users.id',
        'users.email',
        'users.first_name as firstName',
        'users.last_name as lastName',
        'user_organizations.role'
      );
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
