// Journal Entry routes
const express = require('express');
const router = express.Router({ mergeParams: true }); // To access orgId from parent router
const db = require('../db');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const Joi = require('joi');

// Apply authentication middleware to all routes
router.use(authenticate);

// Validation schemas
const createJournalEntrySchema = Joi.object({
  entryDate: Joi.date().required(),
  fiscalPeriodId: Joi.number().integer().required(),
  description: Joi.string().allow('', null),
  reference: Joi.string().allow('', null),
  currencyCode: Joi.string().length(3).default('USD'),
  exchangeRate: Joi.number().positive().default(1.0),
  items: Joi.array().items(
    Joi.object({
      accountId: Joi.number().integer().required(),
      description: Joi.string().allow('', null),
      debitAmount: Joi.number().min(0).default(0),
      creditAmount: Joi.number().min(0).default(0),
      memo: Joi.string().allow('', null),
      dimensions: Joi.object().allow(null)
    })
  ).min(2).required()
});

// Middleware to check organization access
const checkOrgAccess = async (req, res, next) => {
  try {
    const orgId = req.params.orgId;
    
    // Check if user has access to this organization
    const hasAccess = req.user.organizations.some(org => org.id === parseInt(orgId));
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this organization'
        }
      });
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

router.use(checkOrgAccess);

// Get all journal entries for an organization
router.get('/', async (req, res, next) => {
  try {
    const orgId = req.params.orgId;
    const { 
      status, startDate, endDate, reference, search,
      page = 1, limit = 20 
    } = req.query;
    
    // Build query
    let query = db('journal_entries')
      .where('organization_id', orgId)
      .select(
        'id',
        'entry_no as entryNo',
        'entry_date as entryDate',
        'description',
        'reference',
        'status',
        'currency_code as currencyCode',
        'created_at as createdAt',
        'posted_at as postedAt'
      );
    
    // Apply filters
    if (status) {
      query = query.where('status', status);
    }
    
    if (startDate) {
      query = query.where('entry_date', '>=', startDate);
    }
    
    if (endDate) {
      query = query.where('entry_date', '<=', endDate);
    }
    
    if (reference) {
      query = query.where('reference', 'like', `%${reference}%`);
    }
    
    if (search) {
      query = query.where(function() {
        this.where('entry_no', 'like', `%${search}%`)
            .orWhere('description', 'like', `%${search}%`)
            .orWhere('reference', 'like', `%${search}%`);
      });
    }
    
    // Count total results
    const [{ count }] = await db('journal_entries')
      .where('organization_id', orgId)
      .count('id as count');
    
    // Pagination
    const offset = (page - 1) * limit;
    query = query.orderBy('entry_date', 'desc')
                .limit(limit)
                .offset(offset);
    
    // Execute query
    const journalEntries = await query;
    
    // Calculate pagination info
    const totalPages = Math.ceil(count / limit);
    
    res.json({
      success: true,
      data: {
        journalEntries,
        pagination: {
          total: parseInt(count),
          page: parseInt(page),
          limit: parseInt(limit),
          pages: totalPages
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Create a new journal entry
router.post('/', validate(createJournalEntrySchema), async (req, res, next) => {
  try {
    const orgId = req.params.orgId;
    const { 
      entryDate, fiscalPeriodId, description, reference,
      currencyCode, exchangeRate, items 
    } = req.body;
    
    // Check if fiscal period exists and belongs to this organization
    const fiscalPeriod = await db('fiscal_periods')
      .join('fiscal_years', 'fiscal_periods.fiscal_year_id', 'fiscal_years.id')
      .where({ 
        'fiscal_periods.id': fiscalPeriodId,
        'fiscal_years.organization_id': orgId
      })
      .select('fiscal_periods.id', 'fiscal_periods.is_closed')
      .first();
    
    if (!fiscalPeriod) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FISCAL_PERIOD',
          message: 'The specified fiscal period does not exist or does not belong to this organization'
        }
      });
    }
    
    // Check if fiscal period is closed
    if (fiscalPeriod.is_closed) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'FISCAL_PERIOD_CLOSED',
          message: 'Cannot create journal entries in a closed fiscal period'
        }
      });
    }
    
    // Check if currency exists
    const currency = await db('currencies')
      .where({ code: currencyCode })
      .first();
    
    if (!currency) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CURRENCY',
          message: 'The specified currency does not exist'
        }
      });
    }
    
    // Validate accounts
    const accountIds = items.map(item => item.accountId);
    const accounts = await db('accounts')
      .whereIn('id', accountIds)
      .where('organization_id', orgId)
      .select('id', 'name', 'is_active');
    
    // Check if all accounts exist and belong to this organization
    if (accounts.length !== accountIds.length) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ACCOUNTS',
          message: 'One or more specified accounts do not exist or do not belong to this organization'
        }
      });
    }
    
    // Check if all accounts are active
    const inactiveAccounts = accounts.filter(account => !account.is_active);
    if (inactiveAccounts.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INACTIVE_ACCOUNTS',
          message: `Cannot use inactive accounts: ${inactiveAccounts.map(a => a.name).join(', ')}`
        }
      });
    }
    
    // Check if journal entry balances (total debits = total credits)
    const totalDebits = items.reduce((sum, item) => sum + parseFloat(item.debitAmount || 0), 0);
    const totalCredits = items.reduce((sum, item) => sum + parseFloat(item.creditAmount || 0), 0);
    
    // Allow for small rounding differences (0.01)
    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'UNBALANCED_ENTRY',
          message: 'Journal entry must balance (total debits must equal total credits)',
          details: {
            totalDebits,
            totalCredits,
            difference: totalDebits - totalCredits
          }
        }
      });
    }
    
    // Generate entry number
    const currentYear = new Date().getFullYear();
    const [{ maxEntryNo }] = await db('journal_entries')
      .where('organization_id', orgId)
      .whereRaw(`entry_no LIKE 'JE-${currentYear}-%'`)
      .max('entry_no as maxEntryNo');
    
    let entryNumber = 1;
    if (maxEntryNo) {
      const parts = maxEntryNo.split('-');
      entryNumber = parseInt(parts[2]) + 1;
    }
    
    const entryNo = `JE-${currentYear}-${entryNumber.toString().padStart(4, '0')}`;
    
    // Start a transaction
    const trx = await db.transaction();
    
    try {
      // Create journal entry
      const [journalEntryId] = await trx('journal_entries').insert({
        organization_id: orgId,
        entry_no: entryNo,
        entry_date: entryDate,
        fiscal_period_id: fiscalPeriodId,
        description,
        reference,
        source: 'manual',
        status: 'draft',
        currency_code: currencyCode,
        exchange_rate: exchangeRate,
        created_by: req.user.id,
        created_at: new Date(),
        updated_at: new Date()
      }).returning('id');
      
      // Create journal entry items
      const journalEntryItems = items.map(item => ({
        journal_entry_id: journalEntryId,
        account_id: item.accountId,
        description: item.description,
        debit_amount: item.debitAmount || 0,
        credit_amount: item.creditAmount || 0,
        base_debit_amount: (item.debitAmount || 0) * exchangeRate,
        base_credit_amount: (item.creditAmount || 0) * exchangeRate,
        memo: item.memo,
        dimensions: item.dimensions ? JSON.stringify(item.dimensions) : null,
        created_at: new Date()
      }));
      
      await trx('journal_entry_items').insert(journalEntryItems);
      
      // Commit transaction
      await trx.commit();
      
      // Get created journal entry with items
      const journalEntry = await db('journal_entries')
        .where({ id: journalEntryId })
        .select(
          'id',
          'entry_no as entryNo',
          'entry_date as entryDate',
          'description',
          'reference',
          'status',
          'currency_code as currencyCode',
          'exchange_rate as exchangeRate',
          'created_at as createdAt'
        )
        .first();
      
      const journalEntryItemsResult = await db('journal_entry_items')
        .join('accounts', 'journal_entry_items.account_id', 'accounts.id')
        .where('journal_entry_id', journalEntryId)
        .select(
          'journal_entry_items.id',
          'journal_entry_items.account_id as accountId',
          'accounts.code as accountCode',
          'accounts.name as accountName',
          'journal_entry_items.description',
          'journal_entry_items.debit_amount as debitAmount',
          'journal_entry_items.credit_amount as creditAmount',
          'journal_entry_items.memo',
          'journal_entry_items.dimensions'
        );
      
      // Parse dimensions if present
      journalEntryItemsResult.forEach(item => {
        if (item.dimensions) {
          item.dimensions = JSON.parse(item.dimensions);
        }
      });
      
      journalEntry.items = journalEntryItemsResult;
      
      res.status(201).json({
        success: true,
        message: 'Journal entry created successfully',
        data: journalEntry
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

// Get journal entry by ID
router.get('/:id', async (req, res, next) => {
  try {
    const orgId = req.params.orgId;
    const journalEntryId = req.params.id;
    
    // Get journal entry
    const journalEntry = await db('journal_entries')
      .where({
        id: journalEntryId,
        organization_id: orgId
      })
      .select(
        'id',
        'entry_no as entryNo',
        'entry_date as entryDate',
        'fiscal_period_id as fiscalPeriodId',
        'description',
        'reference',
        'source',
        'status',
        'currency_code as currencyCode',
        'exchange_rate as exchangeRate',
        'created_by as createdBy',
        'approved_by as approvedBy',
        'created_at as createdAt',
        'updated_at as updatedAt',
        'posted_at as postedAt'
      )
      .first();
    
    if (!journalEntry) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Journal entry not found'
        }
      });
    }
    
    // Get journal entry items
    const journalEntryItems = await db('journal_entry_items')
      .join('accounts', 'journal_entry_items.account_id', 'accounts.id')
      .where('journal_entry_id', journalEntryId)
      .select(
        'journal_entry_items.id',
        'journal_entry_items.account_id as accountId',
        'accounts.code as accountCode',
        'accounts.name as accountName',
        'journal_entry_items.description',
        'journal_entry_items.debit_amount as debitAmount',
        'journal_entry_items.credit_amount as creditAmount',
        'journal_entry_items.base_debit_amount as baseDebitAmount',
        'journal_entry_items.base_credit_amount as baseCreditAmount',
        'journal_entry_items.memo',
        'journal_entry_items.dimensions'
      );
    
    // Parse dimensions if present
    journalEntryItems.forEach(item => {
      if (item.dimensions) {
        item.dimensions = JSON.parse(item.dimensions);
      }
    });
    
    journalEntry.items = journalEntryItems;
    
    // Get fiscal period info
    if (journalEntry.fiscalPeriodId) {
      const fiscalPeriod = await db('fiscal_periods')
        .join('fiscal_years', 'fiscal_periods.fiscal_year_id', 'fiscal_years.id')
        .where('fiscal_periods.id', journalEntry.fiscalPeriodId)
        .select(
          'fiscal_periods.id',
          'fiscal_periods.name as periodName',
          'fiscal_periods.start_date as startDate',
          'fiscal_periods.end_date as endDate',
          'fiscal_periods.is_closed as isClosed',
          'fiscal_years.name as yearName'
        )
        .first();
      
      journalEntry.fiscalPeriod = fiscalPeriod;
    }
    
    // Get creator info
    if (journalEntry.createdBy) {
      const creator = await db('users')
        .where('id', journalEntry.createdBy)
        .select('id', 'email', 'first_name as firstName', 'last_name as lastName')
        .first();
      
      journalEntry.creator = creator;
    }
    
    // Get approver info
    if (journalEntry.approvedBy) {
      const approver = await db('users')
        .where('id', journalEntry.approvedBy)
        .select('id', 'email', 'first_name as firstName', 'last_name as lastName')
        .first();
      
      journalEntry.approver = approver;
    }
    
    res.json({
      success: true,
      data: journalEntry
    });
  } catch (error) {
    next(error);
  }
});

// Post journal entry
router.post('/:id/post', async (req, res, next) => {
  try {
    const orgId = req.params.orgId;
    const journalEntryId = req.params.id;
    
    // Get journal entry
    const journalEntry = await db('journal_entries')
      .where({
        id: journalEntryId,
        organization_id: orgId
      })
      .first();
    
    if (!journalEntry) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Journal entry not found'
        }
      });
    }
    
    // Check if journal entry is already posted
    if (journalEntry.status === 'posted') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_POSTED',
          message: 'Journal entry is already posted'
        }
      });
    }
    
    // Check if journal entry is voided
    if (journalEntry.status === 'voided') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ENTRY_VOIDED',
          message: 'Cannot post a voided journal entry'
        }
      });
    }
    
    // Check if fiscal period is closed
    const fiscalPeriod = await db('fiscal_periods')
      .where('id', journalEntry.fiscal_period_id)
      .first();
    
    if (fiscalPeriod.is_closed) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'FISCAL_PERIOD_CLOSED',
          message: 'Cannot post journal entries to a closed fiscal period'
        }
      });
    }
    
    // Get journal entry items
    const journalEntryItems = await db('journal_entry_items')
      .where('journal_entry_id', journalEntryId)
      .select('*');
    
    // Check if journal entry balances
    const totalDebits = journalEntryItems.reduce((sum, item) => sum + parseFloat(item.debit_amount || 0), 0);
    const totalCredits = journalEntryItems.reduce((sum, item) => sum + parseFloat(item.credit_amount || 0), 0);
    
    // Allow for small rounding differences (0.01)
    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'UNBALANCED_ENTRY',
          message: 'Journal entry must balance (total debits must equal total credits)',
          details: {
            totalDebits,
            totalCredits,
            difference: totalDebits - totalCredits
          }
        }
      });
    }
    
    // Start a transaction
    const trx = await db.transaction();
    
    try {
      // Update journal entry status
      await trx('journal_entries')
        .where('id', journalEntryId)
        .update({
          status: 'posted',
          posted_at: new Date(),
          approved_by: req.user.id,
          updated_at: new Date()
        });
      
      // Create general ledger entries
      const generalLedgerEntries = [];
      
      for (const item of journalEntryItems) {
        // Get account
        const account = await trx('accounts')
          .join('account_types', 'accounts.account_type_id', 'account_types.id')
          .where('accounts.id', item.account_id)
          .select(
            'accounts.id',
            'account_types.normal_balance'
          )
          .first();
        
        // Get current balance
        const [{ currentBalance = 0 }] = await trx('general_ledger')
          .where({
            organization_id: orgId,
            account_id: item.account_id
          })
          .orderBy('id', 'desc')
          .limit(1)
          .select('base_balance as currentBalance')
          .union(function() {
            this.select(0).as('currentBalance');
          });
        
        // Calculate new balance
        let newBalance = parseFloat(currentBalance);
        
        if (account.normal_balance === 'debit') {
          newBalance += parseFloat(item.base_debit_amount || 0) - parseFloat(item.base_credit_amount || 0);
        } else {
          newBalance += parseFloat(item.base_credit_amount || 0) - parseFloat(item.base_debit_amount || 0);
        }
        
        // Create general ledger entry
        generalLedgerEntries.push({
          organization_id: orgId,
          fiscal_period_id: journalEntry.fiscal_period_id,
          account_id: item.account_id,
          journal_entry_id: journalEntryId,
          journal_entry_item_id: item.id,
          transaction_date: journalEntry.entry_date,
          description: item.description || journalEntry.description,
          debit_amount: item.debit_amount,
          credit_amount: item.credit_amount,
          balance: newBalance,
          currency_code: journalEntry.currency_code,
          base_debit_amount: item.base_debit_amount,
          base_credit_amount: item.base_credit_amount,
          base_balance: newBalance,
          dimensions: item.dimensions,
          created_at: new Date()
        });
      }
      
      // Insert general ledger entries
      await trx('general_ledger').insert(generalLedgerEntries);
      
      // Update account balances
      for (const item of journalEntryItems) {
        // Get existing balance record
        const accountBalance = await trx('account_balances')
          .where({
            organization_id: orgId,
            fiscal_period_id: journalEntry.fiscal_period_id,
            account_id: item.account_id
          })
          .first();
        
        if (accountBalance) {
          // Update existing balance
          await trx('account_balances')
            .where('id', accountBalance.id)
            .update({
              debit_amount: parseFloat(accountBalance.debit_amount) + parseFloat(item.debit_amount || 0),
              credit_amount: parseFloat(accountBalance.credit_amount) + parseFloat(item.credit_amount || 0),
              closing_balance: parseFloat(accountBalance.opening_balance) + 
                               parseFloat(accountBalance.debit_amount) + parseFloat(item.debit_amount || 0) - 
                               parseFloat(accountBalance.credit_amount) - parseFloat(item.credit_amount || 0),
              base_debit_amount: parseFloat(accountBalance.base_debit_amount) + parseFloat(item.base_debit_amount || 0),
              base_credit_amount: parseFloat(accountBalance.base_credit_amount) + parseFloat(item.base_credit_amount || 0),
              base_closing_balance: parseFloat(accountBalance.base_opening_balance) + 
                                   parseFloat(accountBalance.base_debit_amount) + parseFloat(item.base_debit_amount || 0) - 
                                   parseFloat(accountBalance.base_credit_amount) - parseFloat(item.base_credit_amount || 0),
              last_updated_at: new Date()
            });
        } else {
          // Create new balance record
          await trx('account_balances').insert({
            organization_id: orgId,
            fiscal_period_id: journalEntry.fiscal_period_id,
            account_id: item.account_id,
            opening_balance: 0,
            debit_amount: item.debit_amount || 0,
            credit_amount: item.credit_amount || 0,
            closing_balance: parseFloat(item.debit_amount || 0) - parseFloat(item.credit_amount || 0),
            currency_code: journalEntry.currency_code,
            base_opening_balance: 0,
            base_debit_amount: item.base_debit_amount || 0,
            base_credit_amount: item.base_credit_amount || 0,
            base_closing_balance: parseFloat(item.base_debit_amount || 0) - parseFloat(item.base_credit_amount || 0),
            last_updated_at: new Date()
          });
        }
      }
      
      // Commit transaction
      await trx.commit();
      
      res.json({
        success: true,
        message: 'Journal entry posted successfully',
        data: {
          id: journalEntryId,
          entryNo: journalEntry.entry_no,
          status: 'posted',
          postedAt: new Date()
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

module.exports = router;
