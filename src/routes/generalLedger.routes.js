// General Ledger routes with flattened structure (no nested parameters)
const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticate = require('../middleware/authenticate');

// Apply authentication middleware to all routes
router.use(authenticate);

// Get general ledger for an account - Flattened route
router.get('/accounts/:accountId/organization/:organizationId', async (req, res, next) => {
  try {
    const orgId = req.params.organizationId;
    const accountId = req.params.accountId;
    const { startDate, endDate, page = 1, limit = 50 } = req.query;
    
    // Check if account exists and belongs to this organization
    const account = await db('accounts')
      .join('account_types', 'accounts.account_type_id', 'account_types.id')
      .where({ 
        'accounts.id': accountId,
        'accounts.organization_id': orgId
      })
      .select(
        'accounts.id',
        'accounts.code',
        'accounts.name',
        'account_types.name as accountTypeName',
        'account_types.normal_balance as normalBalance'
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
    
    // Build query for transactions
    let query = db('journal_entry_lines')
      .join('journal_entries', 'journal_entry_lines.journal_entry_id', 'journal_entries.id')
      .where({
        'journal_entry_lines.account_id': accountId,
        'journal_entries.organization_id': orgId,
        'journal_entries.status': 'posted'
      })
      .orderBy('journal_entries.date', 'desc')
      .orderBy('journal_entries.id', 'desc');
    
    // Apply date filters if provided
    if (startDate) {
      query = query.where('journal_entries.date', '>=', startDate);
    }
    
    if (endDate) {
      query = query.where('journal_entries.date', '<=', endDate);
    }
    
    // Get total count for pagination
    const [{ count }] = await db('journal_entry_lines')
      .join('journal_entries', 'journal_entry_lines.journal_entry_id', 'journal_entries.id')
      .where({
        'journal_entry_lines.account_id': accountId,
        'journal_entries.organization_id': orgId,
        'journal_entries.status': 'posted'
      })
      .modify(builder => {
        if (startDate) {
          builder.where('journal_entries.date', '>=', startDate);
        }
        if (endDate) {
          builder.where('journal_entries.date', '<=', endDate);
        }
      })
      .count('journal_entry_lines.id as count');
    
    // Get paginated transactions
    const transactions = await query
      .select(
        'journal_entries.id as journalEntryId',
        'journal_entries.date',
        'journal_entries.reference',
        'journal_entries.description as journalDescription',
        'journal_entry_lines.description as lineDescription',
        'journal_entry_lines.debit_amount as debitAmount',
        'journal_entry_lines.credit_amount as creditAmount'
      )
      .limit(limit)
      .offset((page - 1) * limit);
    
    // Calculate running balance
    let runningBalance = 0;
    
    // If we're not starting from the beginning, get the balance up to the start point
    if (page > 1 || startDate) {
      const balanceQuery = db('journal_entry_lines')
        .join('journal_entries', 'journal_entry_lines.journal_entry_id', 'journal_entries.id')
        .where({
          'journal_entry_lines.account_id': accountId,
          'journal_entries.organization_id': orgId,
          'journal_entries.status': 'posted'
        });
      
      if (startDate) {
        balanceQuery.where('journal_entries.date', '<', startDate);
      } else {
        // If no start date, get all transactions before the current page
        const offset = (page - 1) * limit;
        balanceQuery
          .orderBy('journal_entries.date', 'desc')
          .orderBy('journal_entries.id', 'desc')
          .offset(offset);
      }
      
      const previousTransactions = await balanceQuery
        .select(
          'journal_entry_lines.debit_amount as debitAmount',
          'journal_entry_lines.credit_amount as creditAmount'
        );
      
      // Calculate balance based on account's normal balance
      for (const transaction of previousTransactions) {
        if (account.normalBalance === 'debit') {
          runningBalance += parseFloat(transaction.debitAmount || 0) - parseFloat(transaction.creditAmount || 0);
        } else {
          runningBalance += parseFloat(transaction.creditAmount || 0) - parseFloat(transaction.debitAmount || 0);
        }
      }
    }
    
    // Add running balance to transactions
    transactions.forEach(transaction => {
      if (account.normalBalance === 'debit') {
        runningBalance += parseFloat(transaction.debitAmount || 0) - parseFloat(transaction.creditAmount || 0);
      } else {
        runningBalance += parseFloat(transaction.creditAmount || 0) - parseFloat(transaction.debitAmount || 0);
      }
      
      transaction.balance = runningBalance;
    });
    
    // Reverse the transactions to show in chronological order
    transactions.reverse();
    
    res.json({
      success: true,
      data: {
        account,
        transactions,
        pagination: {
          total: parseInt(count),
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
