// Account routes with flattened structure (no nested parameters)
const express = require('express');
const router = express.Router();
const Joi = require('joi');
const db = require('../db');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');

// Apply authentication middleware to all routes
router.use(authenticate);

// Validation schemas
const createAccountSchema = Joi.object({
  organizationId: Joi.number().integer().required(),
  code: Joi.string().required(),
  name: Joi.string().required(),
  description: Joi.string().allow('', null),
  accountTypeId: Joi.number().integer().required(),
  accountCategoryId: Joi.number().integer().required(),
  parentAccountId: Joi.number().integer().allow(null),
  isActive: Joi.boolean().default(true),
  isBankAccount: Joi.boolean().default(false),
  bankAccountDetails: Joi.object().allow(null)
});

const updateAccountSchema = Joi.object({
  code: Joi.string(),
  name: Joi.string(),
  description: Joi.string().allow('', null),
  accountTypeId: Joi.number().integer(),
  accountCategoryId: Joi.number().integer(),
  parentAccountId: Joi.number().integer().allow(null),
  isActive: Joi.boolean(),
  isBankAccount: Joi.boolean(),
  bankAccountDetails: Joi.object().allow(null)
});

// Get account types - Flattened route
router.get('/types', async (req, res, next) => {
  try {
    const accountTypes = await db('account_types')
      .select('id', 'name', 'normal_balance as normalBalance', 'description');
    
    res.json({
      success: true,
      data: accountTypes
    });
  } catch (error) {
    next(error);
  }
});

// Get account categories for an organization - Flattened route
router.get('/categories/organization/:organizationId', async (req, res, next) => {
  try {
    const orgId = req.params.organizationId;
    
    const accountCategories = await db('account_categories')
      .join('account_types', 'account_categories.account_type_id', 'account_types.id')
      .where('account_categories.organization_id', orgId)
      .select(
        'account_categories.id',
        'account_categories.name',
        'account_categories.description',
        'account_categories.account_type_id as accountTypeId',
        'account_types.name as accountTypeName'
      );
    
    res.json({
      success: true,
      data: accountCategories
    });
  } catch (error) {
    next(error);
  }
});

// Get all accounts for an organization - Flattened route
router.get('/organization/:organizationId', async (req, res, next) => {
  try {
    const orgId = req.params.organizationId;
    
    // Get accounts
    const accounts = await db('accounts')
      .join('account_types', 'accounts.account_type_id', 'account_types.id')
      .leftJoin('account_categories', 'accounts.account_category_id', 'account_categories.id')
      .where('accounts.organization_id', orgId)
      .select(
        'accounts.id',
        'accounts.code',
        'accounts.name',
        'accounts.description',
        'accounts.parent_account_id as parentAccountId',
        'accounts.is_active as isActive',
        'accounts.is_bank_account as isBankAccount',
        'accounts.bank_account_details as bankAccountDetails',
        'account_types.id as accountTypeId',
        'account_types.name as accountTypeName',
        'account_types.normal_balance as normalBalance',
        'account_categories.id as accountCategoryId',
        'account_categories.name as accountCategoryName',
        'accounts.created_at as createdAt',
        'accounts.updated_at as updatedAt'
      )
      .orderBy(['account_types.id', 'account_categories.name', 'accounts.code']);
    
    // Parse bank account details if present
    accounts.forEach(account => {
      if (account.bankAccountDetails) {
        account.bankAccountDetails = JSON.parse(account.bankAccountDetails);
      }
    });
    
    res.json({
      success: true,
      data: accounts
    });
  } catch (error) {
    next(error);
  }
});

// Get account by ID - Flattened route
router.get('/:accountId/organization/:organizationId', async (req, res, next) => {
  try {
    const orgId = req.params.organizationId;
    const accountId = req.params.accountId;
    
    // Get account
    const account = await db('accounts')
      .join('account_types', 'accounts.account_type_id', 'account_types.id')
      .leftJoin('account_categories', 'accounts.account_category_id', 'account_categories.id')
      .where({
        'accounts.id': accountId,
        'accounts.organization_id': orgId
      })
      .select(
        'accounts.id',
        'accounts.code',
        'accounts.name',
        'accounts.description',
        'accounts.parent_account_id as parentAccountId',
        'accounts.is_active as isActive',
        'accounts.is_bank_account as isBankAccount',
        'accounts.bank_account_details as bankAccountDetails',
        'account_types.id as accountTypeId',
        'account_types.name as accountTypeName',
        'account_types.normal_balance as normalBalance',
        'account_categories.id as accountCategoryId',
        'account_categories.name as accountCategoryName',
        'accounts.created_at as createdAt',
        'accounts.updated_at as updatedAt'
      )
      .first();
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ACCOUNT_NOT_FOUND',
          message: 'Account not found'
        }
      });
    }
    
    // Parse bank account details if present
    if (account.bankAccountDetails) {
      account.bankAccountDetails = JSON.parse(account.bankAccountDetails);
    }
    
    res.json({
      success: true,
      data: account
    });
  } catch (error) {
    next(error);
  }
});

// Create a new account - Flattened route
router.post('/', validate(createAccountSchema), async (req, res, next) => {
  try {
    const { 
      organizationId, code, name, description, accountTypeId, accountCategoryId, 
      parentAccountId, isActive, isBankAccount, bankAccountDetails 
    } = req.body;
    
    // Check if account with same code already exists in this organization
    const existingAccount = await db('accounts')
      .where({ 
        organization_id: organizationId,
        code
      })
      .first();
    
    if (existingAccount) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_ACCOUNT_CODE',
          message: 'An account with this code already exists in this organization'
        }
      });
    }
    
    // Check if account type exists
    const accountType = await db('account_types')
      .where({ id: accountTypeId })
      .first();
    
    if (!accountType) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ACCOUNT_TYPE',
          message: 'The specified account type does not exist'
        }
      });
    }
    
    // Check if account category exists and belongs to this organization
    const accountCategory = await db('account_categories')
      .where({ 
        id: accountCategoryId,
        organization_id: organizationId
      })
      .first();
    
    if (!accountCategory) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ACCOUNT_CATEGORY',
          message: 'The specified account category does not exist or does not belong to this organization'
        }
      });
    }
    
    // If parent account is specified, check if it exists and belongs to this organization
    if (parentAccountId) {
      const parentAccount = await db('accounts')
        .where({ 
          id: parentAccountId,
          organization_id: organizationId
        })
        .first();
      
      if (!parentAccount) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PARENT_ACCOUNT',
            message: 'The specified parent account does not exist or does not belong to this organization'
          }
        });
      }
    }
    
    // Create account
    const [accountId] = await db('accounts').insert({
      organization_id: organizationId,
      code,
      name,
      description,
      account_type_id: accountTypeId,
      account_category_id: accountCategoryId,
      parent_account_id: parentAccountId,
      is_active: isActive,
      is_bank_account: isBankAccount,
      bank_account_details: bankAccountDetails ? JSON.stringify(bankAccountDetails) : null,
      created_at: new Date(),
      updated_at: new Date()
    }).returning('id');
    
    // Get created account
    const account = await db('accounts')
      .join('account_types', 'accounts.account_type_id', 'account_types.id')
      .leftJoin('account_categories', 'accounts.account_category_id', 'account_categories.id')
      .where('accounts.id', accountId)
      .select(
        'accounts.id',
        'accounts.code',
        'accounts.name',
        'accounts.description',
        'accounts.parent_account_id as parentAccountId',
        'accounts.is_active as isActive',
        'accounts.is_bank_account as isBankAccount',
        'accounts.bank_account_details as bankAccountDetails',
        'account_types.id as accountTypeId',
        'account_types.name as accountTypeName',
        'account_types.normal_balance as normalBalance',
        'account_categories.id as accountCategoryId',
        'account_categories.name as accountCategoryName',
        'accounts.created_at as createdAt'
      )
      .first();
    
    // Parse bank account details if present
    if (account.bankAccountDetails) {
      account.bankAccountDetails = JSON.parse(account.bankAccountDetails);
    }
    
    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: account
    });
  } catch (error) {
    next(error);
  }
});

// Update account - Flattened route
router.put('/:accountId/organization/:organizationId', validate(updateAccountSchema), async (req, res, next) => {
  try {
    const orgId = req.params.organizationId;
    const accountId = req.params.accountId;
    
    // Check if account exists and belongs to this organization
    const existingAccount = await db('accounts')
      .where({ 
        id: accountId,
        organization_id: orgId
      })
      .first();
    
    if (!existingAccount) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ACCOUNT_NOT_FOUND',
          message: 'Account not found'
        }
      });
    }
    
    const { 
      code, name, description, accountTypeId, accountCategoryId, 
      parentAccountId, isActive, isBankAccount, bankAccountDetails 
    } = req.body;
    
    // If code is being changed, check if new code is already in use
    if (code && code !== existingAccount.code) {
      const duplicateCode = await db('accounts')
        .where({ 
          organization_id: orgId,
          code
        })
        .whereNot({ id: accountId })
        .first();
      
      if (duplicateCode) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'DUPLICATE_ACCOUNT_CODE',
            message: 'An account with this code already exists in this organization'
          }
        });
      }
    }
    
    // If account type is being changed, check if new type exists
    if (accountTypeId) {
      const accountType = await db('account_types')
        .where({ id: accountTypeId })
        .first();
      
      if (!accountType) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ACCOUNT_TYPE',
            message: 'The specified account type does not exist'
          }
        });
      }
    }
    
    // If account category is being changed, check if new category exists and belongs to this organization
    if (accountCategoryId) {
      const accountCategory = await db('account_categories')
        .where({ 
          id: accountCategoryId,
          organization_id: orgId
        })
        .first();
      
      if (!accountCategory) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ACCOUNT_CATEGORY',
            message: 'The specified account category does not exist or does not belong to this organization'
          }
        });
      }
    }
    
    // If parent account is being changed, check if new parent exists and belongs to this organization
    if (parentAccountId !== undefined) {
      if (parentAccountId === accountId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PARENT_ACCOUNT',
            message: 'An account cannot be its own parent'
          }
        });
      }
      
      if (parentAccountId !== null) {
        const parentAccount = await db('accounts')
          .where({ 
            id: parentAccountId,
            organization_id: orgId
          })
          .first();
        
        if (!parentAccount) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_PARENT_ACCOUNT',
              message: 'The specified parent account does not exist or does not belong to this organization'
            }
          });
        }
      }
    }
    
    // Prepare update data
    const updateData = {};
    
    if (code !== undefined) updateData.code = code;
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (accountTypeId !== undefined) updateData.account_type_id = accountTypeId;
    if (accountCategoryId !== undefined) updateData.account_category_id = accountCategoryId;
    if (parentAccountId !== undefined) updateData.parent_account_id = parentAccountId;
    if (isActive !== undefined) updateData.is_active = isActive;
    if (isBankAccount !== undefined) updateData.is_bank_account = isBankAccount;
    if (bankAccountDetails !== undefined) {
      updateData.bank_account_details = bankAccountDetails ? JSON.stringify(bankAccountDetails) : null;
    }
    
    updateData.updated_at = new Date();
    
    // Update account
    await db('accounts')
      .where({ id: accountId })
      .update(updateData);
    
    // Get updated account
    const account = await db('accounts')
      .join('account_types', 'accounts.account_type_id', 'account_types.id')
      .leftJoin('account_categories', 'accounts.account_category_id', 'account_categories.id')
      .where('accounts.id', accountId)
      .select(
        'accounts.id',
        'accounts.code',
        'accounts.name',
        'accounts.description',
        'accounts.parent_account_id as parentAccountId',
        'accounts.is_active as isActive',
        'accounts.is_bank_account as isBankAccount',
        'accounts.bank_account_details as bankAccountDetails',
        'account_types.id as accountTypeId',
        'account_types.name as accountTypeName',
        'account_types.normal_balance as normalBalance',
        'account_categories.id as accountCategoryId',
        'account_categories.name as accountCategoryName',
        'accounts.updated_at as updatedAt'
      )
      .first();
    
    // Parse bank account details if present
    if (account.bankAccountDetails) {
      account.bankAccountDetails = JSON.parse(account.bankAccountDetails);
    }
    
    res.json({
      success: true,
      message: 'Account updated successfully',
      data: account
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
