// General Ledger routes
const express = require('express');
const router = express.Router({ mergeParams: true }); // To access orgId from parent router
const db = require('../db');
const authenticate = require('../middleware/authenticate');

// Apply authentication middleware to all routes
router.use(authenticate);

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

// Get general ledger entries
router.get('/', async (req, res, next) => {
  try {
    const orgId = req.params.orgId;
    const { 
      accountId, startDate, endDate, fiscalPeriodId,
      page = 1, limit = 50 
    } = req.query;
    
    // Build query
    let query = db('general_ledger')
      .join('accounts', 'general_ledger.account_id', 'accounts.id')
      .leftJoin('journal_entries', 'general_ledger.journal_entry_id', 'journal_entries.id')
      .where('general_ledger.organization_id', orgId)
      .select(
        'general_ledger.id',
        'general_ledger.transaction_date as transactionDate',
        'general_ledger.description',
        'general_ledger.debit_amount as debitAmount',
        'general_ledger.credit_amount as creditAmount',
        'general_ledger.balance',
        'general_ledger.currency_code as currencyCode',
        'general_ledger.base_debit_amount as baseDebitAmount',
        'general_ledger.base_credit_amount as baseCreditAmount',
        'general_ledger.base_balance as baseBalance',
        'accounts.id as accountId',
        'accounts.code as accountCode',
        'accounts.name as accountName',
        'journal_entries.entry_no as journalEntryNo',
        'journal_entries.reference as journalEntryReference',
        'general_ledger.created_at as createdAt'
      );
    
    // Apply filters
    if (accountId) {
      query = query.where('general_ledger.account_id', accountId);
    }
    
    if (startDate) {
      query = query.where('general_ledger.transaction_date', '>=', startDate);
    }
    
    if (endDate) {
      query = query.where('general_ledger.transaction_date', '<=', endDate);
    }
    
    if (fiscalPeriodId) {
      query = query.where('general_ledger.fiscal_period_id', fiscalPeriodId);
    }
    
    // Count total results
    const countQuery = db('general_ledger')
      .where('organization_id', orgId);
    
    if (accountId) {
      countQuery.where('account_id', accountId);
    }
    
    if (startDate) {
      countQuery.where('transaction_date', '>=', startDate);
    }
    
    if (endDate) {
      countQuery.where('transaction_date', '<=', endDate);
    }
    
    if (fiscalPeriodId) {
      countQuery.where('fiscal_period_id', fiscalPeriodId);
    }
    
    const [{ count }] = await countQuery.count('id as count');
    
    // Pagination
    const offset = (page - 1) * limit;
    query = query.orderBy([
      { column: 'general_ledger.transaction_date', order: 'asc' },
      { column: 'general_ledger.id', order: 'asc' }
    ])
    .limit(limit)
    .offset(offset);
    
    // Execute query
    const ledgerEntries = await query;
    
    // Parse dimensions if present
    ledgerEntries.forEach(entry => {
      if (entry.dimensions) {
        entry.dimensions = JSON.parse(entry.dimensions);
      }
    });
    
    // Calculate pagination info
    const totalPages = Math.ceil(count / limit);
    
    res.json({
      success: true,
      data: {
        ledgerEntries,
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

// Get general ledger for a specific account
router.get('/account/:accountId', async (req, res, next) => {
  try {
    const orgId = req.params.orgId;
    const accountId = req.params.accountId;
    const { 
      startDate, endDate, fiscalPeriodId,
      page = 1, limit = 50 
    } = req.query;
    
    // Check if account exists and belongs to this organization
    const account = await db('accounts')
      .where({ 
        id: accountId,
        organization_id: orgId
      })
      .select('id', 'code', 'name')
      .first();
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Account not found'
        }
      });
    }
    
    // Build query
    let query = db('general_ledger')
      .leftJoin('journal_entries', 'general_ledger.journal_entry_id', 'journal_entries.id')
      .where({
        'general_ledger.organization_id': orgId,
        'general_ledger.account_id': accountId
      })
      .select(
        'general_ledger.id',
        'general_ledger.transaction_date as transactionDate',
        'general_ledger.description',
        'general_ledger.debit_amount as debitAmount',
        'general_ledger.credit_amount as creditAmount',
        'general_ledger.balance',
        'general_ledger.currency_code as currencyCode',
        'general_ledger.base_debit_amount as baseDebitAmount',
        'general_ledger.base_credit_amount as baseCreditAmount',
        'general_ledger.base_balance as baseBalance',
        'journal_entries.entry_no as journalEntryNo',
        'journal_entries.reference as journalEntryReference',
        'general_ledger.created_at as createdAt'
      );
    
    // Apply filters
    if (startDate) {
      query = query.where('general_ledger.transaction_date', '>=', startDate);
    }
    
    if (endDate) {
      query = query.where('general_ledger.transaction_date', '<=', endDate);
    }
    
    if (fiscalPeriodId) {
      query = query.where('general_ledger.fiscal_period_id', fiscalPeriodId);
    }
    
    // Count total results
    const countQuery = db('general_ledger')
      .where({
        organization_id: orgId,
        account_id: accountId
      });
    
    if (startDate) {
      countQuery.where('transaction_date', '>=', startDate);
    }
    
    if (endDate) {
      countQuery.where('transaction_date', '<=', endDate);
    }
    
    if (fiscalPeriodId) {
      countQuery.where('fiscal_period_id', fiscalPeriodId);
    }
    
    const [{ count }] = await countQuery.count('id as count');
    
    // Pagination
    const offset = (page - 1) * limit;
    query = query.orderBy([
      { column: 'general_ledger.transaction_date', order: 'asc' },
      { column: 'general_ledger.id', order: 'asc' }
    ])
    .limit(limit)
    .offset(offset);
    
    // Execute query
    const ledgerEntries = await query;
    
    // Parse dimensions if present
    ledgerEntries.forEach(entry => {
      if (entry.dimensions) {
        entry.dimensions = JSON.parse(entry.dimensions);
      }
    });
    
    // Calculate pagination info
    const totalPages = Math.ceil(count / limit);
    
    res.json({
      success: true,
      data: {
        account,
        ledgerEntries,
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

// Get account balances
router.get('/account-balances', async (req, res, next) => {
  try {
    const orgId = req.params.orgId;
    const { fiscalPeriodId, accountTypeId } = req.query;
    
    // Build query
    let query = db('account_balances')
      .join('accounts', 'account_balances.account_id', 'accounts.id')
      .join('account_types', 'accounts.account_type_id', 'account_types.id')
      .leftJoin('account_categories', 'accounts.account_category_id', 'account_categories.id')
      .where('account_balances.organization_id', orgId);
    
    if (fiscalPeriodId) {
      query = query.where('account_balances.fiscal_period_id', fiscalPeriodId);
    }
    
    if (accountTypeId) {
      query = query.where('accounts.account_type_id', accountTypeId);
    }
    
    const accountBalances = await query.select(
      'account_balances.id',
      'account_balances.fiscal_period_id as fiscalPeriodId',
      'accounts.id as accountId',
      'accounts.code as accountCode',
      'accounts.name as accountName',
      'account_types.id as accountTypeId',
      'account_types.name as accountTypeName',
      'account_types.normal_balance as normalBalance',
      'account_categories.id as accountCategoryId',
      'account_categories.name as accountCategoryName',
      'account_balances.opening_balance as openingBalance',
      'account_balances.debit_amount as debitAmount',
      'account_balances.credit_amount as creditAmount',
      'account_balances.closing_balance as closingBalance',
      'account_balances.currency_code as currencyCode',
      'account_balances.base_opening_balance as baseOpeningBalance',
      'account_balances.base_debit_amount as baseDebitAmount',
      'account_balances.base_credit_amount as baseCreditAmount',
      'account_balances.base_closing_balance as baseClosingBalance',
      'account_balances.last_updated_at as lastUpdatedAt'
    );
    
    res.json({
      success: true,
      data: accountBalances
    });
  } catch (error) {
    next(error);
  }
});

// Get trial balance
router.get('/trial-balance', async (req, res, next) => {
  try {
    const orgId = req.params.orgId;
    const { fiscalPeriodId } = req.query;
    
    if (!fiscalPeriodId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETER',
          message: 'Fiscal period ID is required'
        }
      });
    }
    
    // Check if fiscal period exists and belongs to this organization
    const fiscalPeriod = await db('fiscal_periods')
      .join('fiscal_years', 'fiscal_periods.fiscal_year_id', 'fiscal_years.id')
      .where({ 
        'fiscal_periods.id': fiscalPeriodId,
        'fiscal_years.organization_id': orgId
      })
      .select(
        'fiscal_periods.id',
        'fiscal_periods.name',
        'fiscal_periods.start_date as startDate',
        'fiscal_periods.end_date as endDate',
        'fiscal_years.name as fiscalYearName'
      )
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
    
    // Get account balances for trial balance
    const accountBalances = await db('account_balances')
      .join('accounts', 'account_balances.account_id', 'accounts.id')
      .join('account_types', 'accounts.account_type_id', 'account_types.id')
      .leftJoin('account_categories', 'accounts.account_category_id', 'account_categories.id')
      .where({
        'account_balances.organization_id': orgId,
        'account_balances.fiscal_period_id': fiscalPeriodId,
        'accounts.is_active': true
      })
      .select(
        'accounts.id as accountId',
        'accounts.code as accountCode',
        'accounts.name as accountName',
        'account_types.id as accountTypeId',
        'account_types.name as accountTypeName',
        'account_types.normal_balance as normalBalance',
        'account_categories.id as accountCategoryId',
        'account_categories.name as accountCategoryName',
        'account_balances.opening_balance as openingBalance',
        'account_balances.debit_amount as debitAmount',
        'account_balances.credit_amount as creditAmount',
        'account_balances.closing_balance as closingBalance',
        'account_balances.base_opening_balance as baseOpeningBalance',
        'account_balances.base_debit_amount as baseDebitAmount',
        'account_balances.base_credit_amount as baseCreditAmount',
        'account_balances.base_closing_balance as baseClosingBalance'
      )
      .orderBy(['account_types.id', 'account_categories.name', 'accounts.code']);
    
    // Calculate totals
    const totals = accountBalances.reduce((acc, balance) => {
      acc.totalDebit += parseFloat(balance.debitAmount) || 0;
      acc.totalCredit += parseFloat(balance.creditAmount) || 0;
      acc.totalBaseDebit += parseFloat(balance.baseDebitAmount) || 0;
      acc.totalBaseCredit += parseFloat(balance.baseCreditAmount) || 0;
      
      // Group by account type
      if (!acc.accountTypes[balance.accountTypeId]) {
        acc.accountTypes[balance.accountTypeId] = {
          id: balance.accountTypeId,
          name: balance.accountTypeName,
          normalBalance: balance.normalBalance,
          totalDebit: 0,
          totalCredit: 0,
          totalBaseDebit: 0,
          totalBaseCredit: 0
        };
      }
      
      acc.accountTypes[balance.accountTypeId].totalDebit += parseFloat(balance.debitAmount) || 0;
      acc.accountTypes[balance.accountTypeId].totalCredit += parseFloat(balance.creditAmount) || 0;
      acc.accountTypes[balance.accountTypeId].totalBaseDebit += parseFloat(balance.baseDebitAmount) || 0;
      acc.accountTypes[balance.accountTypeId].totalBaseCredit += parseFloat(balance.baseCreditAmount) || 0;
      
      return acc;
    }, { 
      totalDebit: 0, 
      totalCredit: 0, 
      totalBaseDebit: 0, 
      totalBaseCredit: 0,
      accountTypes: {}
    });
    
    // Convert account types object to array
    totals.accountTypesSummary = Object.values(totals.accountTypes);
    delete totals.accountTypes;
    
    // Get organization's base currency
    const organization = await db('organizations')
      .where('id', orgId)
      .select('base_currency as baseCurrency')
      .first();
    
    res.json({
      success: true,
      data: {
        fiscalPeriod,
        baseCurrency: organization.baseCurrency,
        accountBalances,
        totals
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
