// Journal Entry routes with flattened structure (no nested parameters)
const express = require('express');
const router = express.Router();
const Joi = require('joi');
const db = require('../db');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');

// Apply authentication middleware to all routes
router.use(authenticate);

// Validation schemas
const createJournalEntrySchema = Joi.object({
  organizationId: Joi.number().integer().required(),
  date: Joi.date().iso().required(),
  reference: Joi.string().required(),
  description: Joi.string().allow('', null),
  lines: Joi.array().items(
    Joi.object({
      accountId: Joi.number().integer().required(),
      description: Joi.string().allow('', null),
      debitAmount: Joi.number().min(0).default(0),
      creditAmount: Joi.number().min(0).default(0),
      taxRate: Joi.number().min(0).max(100).allow(null),
      taxAmount: Joi.number().min(0).allow(null)
    })
  ).min(2).required()
});

// Get all journal entries for an organization - Flattened route
router.get('/organization/:organizationId', async (req, res, next) => {
  try {
    const orgId = req.params.organizationId;
    const { page = 1, limit = 20, startDate, endDate } = req.query;
    
    // Build query
    let query = db('journal_entries')
      .where('organization_id', orgId)
      .orderBy('date', 'desc')
      .orderBy('id', 'desc');
    
    // Apply date filters if provided
    if (startDate) {
      query = query.where('date', '>=', startDate);
    }
    
    if (endDate) {
      query = query.where('date', '<=', endDate);
    }
    
    // Get total count for pagination
    const [{ count }] = await db('journal_entries')
      .where('organization_id', orgId)
      .count('id as count')
      .modify(builder => {
        if (startDate) {
          builder.where('date', '>=', startDate);
        }
        if (endDate) {
          builder.where('date', '<=', endDate);
        }
      });
    
    // Get paginated journal entries
    const journalEntries = await query
      .select(
        'id',
        'date',
        'reference',
        'description',
        'status',
        'created_at as createdAt',
        'updated_at as updatedAt'
      )
      .limit(limit)
      .offset((page - 1) * limit);
    
    // Get journal entry totals
    const journalEntryIds = journalEntries.map(entry => entry.id);
    
    if (journalEntryIds.length > 0) {
      const journalEntryTotals = await db('journal_entry_lines')
        .whereIn('journal_entry_id', journalEntryIds)
        .select('journal_entry_id')
        .sum('debit_amount as totalDebit')
        .sum('credit_amount as totalCredit')
        .groupBy('journal_entry_id');
      
      // Add totals to journal entries
      const totalsMap = {};
      journalEntryTotals.forEach(total => {
        totalsMap[total.journal_entry_id] = {
          totalDebit: parseFloat(total.totalDebit),
          totalCredit: parseFloat(total.totalCredit)
        };
      });
      
      journalEntries.forEach(entry => {
        const totals = totalsMap[entry.id] || { totalDebit: 0, totalCredit: 0 };
        entry.totalDebit = totals.totalDebit;
        entry.totalCredit = totals.totalCredit;
      });
    }
    
    res.json({
      success: true,
      data: journalEntries,
      pagination: {
        total: parseInt(count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get journal entry by ID - Flattened route
router.get('/:id/organization/:organizationId', async (req, res, next) => {
  try {
    const orgId = req.params.organizationId;
    const entryId = req.params.id;
    
    // Get journal entry
    const journalEntry = await db('journal_entries')
      .where({
        id: entryId,
        organization_id: orgId
      })
      .select(
        'id',
        'date',
        'reference',
        'description',
        'status',
        'created_at as createdAt',
        'updated_at as updatedAt'
      )
      .first();
    
    if (!journalEntry) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'JOURNAL_ENTRY_NOT_FOUND',
          message: 'Journal entry not found'
        }
      });
    }
    
    // Get journal entry lines
    const journalEntryLines = await db('journal_entry_lines')
      .join('accounts', 'journal_entry_lines.account_id', 'accounts.id')
      .where('journal_entry_lines.journal_entry_id', entryId)
      .select(
        'journal_entry_lines.id',
        'journal_entry_lines.account_id as accountId',
        'accounts.code as accountCode',
        'accounts.name as accountName',
        'journal_entry_lines.description',
        'journal_entry_lines.debit_amount as debitAmount',
        'journal_entry_lines.credit_amount as creditAmount',
        'journal_entry_lines.tax_rate as taxRate',
        'journal_entry_lines.tax_amount as taxAmount'
      )
      .orderBy('journal_entry_lines.id');
    
    // Calculate totals
    const totals = journalEntryLines.reduce((acc, line) => {
      acc.totalDebit += parseFloat(line.debitAmount) || 0;
      acc.totalCredit += parseFloat(line.creditAmount) || 0;
      acc.totalTax += parseFloat(line.taxAmount) || 0;
      return acc;
    }, { totalDebit: 0, totalCredit: 0, totalTax: 0 });
    
    res.json({
      success: true,
      data: {
        ...journalEntry,
        lines: journalEntryLines,
        totals
      }
    });
  } catch (error) {
    next(error);
  }
});

// Create a new journal entry - Flattened route
router.post('/', validate(createJournalEntrySchema), async (req, res, next) => {
  // Initialize transaction variable
  let trx;
  
  try {
    const { organizationId, date, reference, description, lines } = req.body;
    
    // Validate that debits equal credits
    const totalDebit = lines.reduce((sum, line) => sum + (parseFloat(line.debitAmount) || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (parseFloat(line.creditAmount) || 0), 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'UNBALANCED_ENTRY',
          message: 'Journal entry must be balanced (total debits must equal total credits)',
          details: {
            totalDebit,
            totalCredit,
            difference: totalDebit - totalCredit
          }
        }
      });
    }
    
    // Start transaction
    trx = await db.transaction();
    
    // Create journal entry
    const [journalEntryId] = await trx('journal_entries').insert({
      organization_id: organizationId,
      date,
      reference,
      description,
      status: 'posted',
      created_at: new Date(),
      updated_at: new Date()
    }).returning('id');
    
    // Create journal entry lines
    const journalEntryLines = lines.map(line => ({
      journal_entry_id: journalEntryId,
      account_id: line.accountId,
      description: line.description,
      debit_amount: line.debitAmount || 0,
      credit_amount: line.creditAmount || 0,
      tax_rate: line.taxRate,
      tax_amount: line.taxAmount
    }));
    
    await trx('journal_entry_lines').insert(journalEntryLines);
    
    // Update account balances
    for (const line of lines) {
      // Get account details
      const account = await trx('accounts')
        .join('account_types', 'accounts.account_type_id', 'account_types.id')
        .where('accounts.id', line.accountId)
        .select(
          'accounts.id',
          'accounts.account_type_id as accountTypeId',
          'account_types.normal_balance as normalBalance'
        )
        .first();
      
      if (!account) {
        throw new Error(`Account with ID ${line.accountId} not found`);
      }
      
      // Calculate balance change based on account type
      let balanceChange = 0;
      
      if (account.normalBalance === 'debit') {
        balanceChange = (parseFloat(line.debitAmount) || 0) - (parseFloat(line.creditAmount) || 0);
      } else {
        balanceChange = (parseFloat(line.creditAmount) || 0) - (parseFloat(line.debitAmount) || 0);
      }
      
      // Update account balance
      await trx('account_balances')
        .where({
          account_id: line.accountId,
          organization_id: organizationId
        })
        .increment('balance', balanceChange);
    }
    
    // Commit transaction
    await trx.commit();
    
    // Get created journal entry with lines
    const journalEntry = await db('journal_entries')
      .where('id', journalEntryId)
      .select(
        'id',
        'date',
        'reference',
        'description',
        'status',
        'created_at as createdAt'
      )
      .first();
    
    const createdLines = await db('journal_entry_lines')
      .join('accounts', 'journal_entry_lines.account_id', 'accounts.id')
      .where('journal_entry_lines.journal_entry_id', journalEntryId)
      .select(
        'journal_entry_lines.id',
        'journal_entry_lines.account_id as accountId',
        'accounts.code as accountCode',
        'accounts.name as accountName',
        'journal_entry_lines.description',
        'journal_entry_lines.debit_amount as debitAmount',
        'journal_entry_lines.credit_amount as creditAmount',
        'journal_entry_lines.tax_rate as taxRate',
        'journal_entry_lines.tax_amount as taxAmount'
      )
      .orderBy('journal_entry_lines.id');
    
    res.status(201).json({
      success: true,
      message: 'Journal entry created successfully',
      data: {
        ...journalEntry,
        lines: createdLines,
        totals: {
          totalDebit,
          totalCredit
        }
      }
    });
  } catch (error) {
    // Rollback transaction on error
    if (trx) {
      await trx.rollback();
    }
    
    next(error);
  }
});

module.exports = router;
