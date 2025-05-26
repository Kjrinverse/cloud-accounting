// Report routes with flattened structure (no nested parameters)
const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticate = require('../middleware/authenticate');

// Apply authentication middleware to all routes
router.use(authenticate);

// Get trial balance for an organization - Flattened route
router.get('/trial-balance/organization/:organizationId', async (req, res, next) => {
  try {
    const orgId = req.params.organizationId;
    const { asOfDate } = req.query;
    
    // Build query for accounts with balances
    let query = db('accounts')
      .join('account_types', 'accounts.account_type_id', 'account_types.id')
      .leftJoin('account_categories', 'accounts.account_category_id', 'account_categories.id')
      .leftJoin('account_balances', function() {
        this.on('account_balances.account_id', '=', 'accounts.id')
            .andOn('account_balances.organization_id', '=', 'accounts.organization_id');
      })
      .where('accounts.organization_id', orgId)
      .orderBy(['account_types.id', 'account_categories.name', 'accounts.code']);
    
    // Apply date filter if provided
    if (asOfDate) {
      // For a historical trial balance, we would need to calculate balances as of the specified date
      // This would involve summing journal entries up to the specified date
      // For simplicity, we'll just use the current balances for now
    }
    
    // Get accounts with balances
    const accounts = await query
      .select(
        'accounts.id',
        'accounts.code',
        'accounts.name',
        'account_types.id as accountTypeId',
        'account_types.name as accountTypeName',
        'account_types.normal_balance as normalBalance',
        'account_categories.id as accountCategoryId',
        'account_categories.name as accountCategoryName',
        'account_balances.balance'
      );
    
    // Group accounts by type and category
    const groupedAccounts = {};
    let totalDebits = 0;
    let totalCredits = 0;
    
    accounts.forEach(account => {
      // Initialize balance if null
      account.balance = account.balance || 0;
      
      // Calculate debit and credit columns based on normal balance and actual balance
      account.debitBalance = 0;
      account.creditBalance = 0;
      
      if (account.normalBalance === 'debit') {
        if (account.balance >= 0) {
          account.debitBalance = account.balance;
          totalDebits += account.balance;
        } else {
          account.creditBalance = Math.abs(account.balance);
          totalCredits += Math.abs(account.balance);
        }
      } else {
        if (account.balance >= 0) {
          account.creditBalance = account.balance;
          totalCredits += account.balance;
        } else {
          account.debitBalance = Math.abs(account.balance);
          totalDebits += Math.abs(account.balance);
        }
      }
      
      // Group by account type
      if (!groupedAccounts[account.accountTypeName]) {
        groupedAccounts[account.accountTypeName] = {
          id: account.accountTypeId,
          name: account.accountTypeName,
          normalBalance: account.normalBalance,
          categories: {},
          totalDebit: 0,
          totalCredit: 0
        };
      }
      
      // Group by account category
      const typeGroup = groupedAccounts[account.accountTypeName];
      const categoryName = account.accountCategoryName || 'Uncategorized';
      
      if (!typeGroup.categories[categoryName]) {
        typeGroup.categories[categoryName] = {
          id: account.accountCategoryId,
          name: categoryName,
          accounts: [],
          totalDebit: 0,
          totalCredit: 0
        };
      }
      
      // Add account to category
      const categoryGroup = typeGroup.categories[categoryName];
      categoryGroup.accounts.push(account);
      
      // Update category totals
      categoryGroup.totalDebit += account.debitBalance;
      categoryGroup.totalCredit += account.creditBalance;
      
      // Update type totals
      typeGroup.totalDebit += account.debitBalance;
      typeGroup.totalCredit += account.creditBalance;
    });
    
    // Convert grouped accounts to array format
    const trialBalance = Object.values(groupedAccounts).map(typeGroup => {
      return {
        ...typeGroup,
        categories: Object.values(typeGroup.categories)
      };
    });
    
    res.json({
      success: true,
      data: {
        trialBalance,
        totals: {
          totalDebits,
          totalCredits,
          difference: Math.abs(totalDebits - totalCredits)
        },
        asOfDate: asOfDate || new Date().toISOString().split('T')[0]
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get income statement for an organization - Flattened route
router.get('/income-statement/organization/:organizationId', async (req, res, next) => {
  try {
    const orgId = req.params.organizationId;
    const { startDate, endDate } = req.query;
    
    // Validate date parameters
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_DATE_PARAMETERS',
          message: 'Both startDate and endDate are required'
        }
      });
    }
    
    // Get revenue accounts
    const revenueAccounts = await db('accounts')
      .join('account_types', 'accounts.account_type_id', 'account_types.id')
      .leftJoin('account_categories', 'accounts.account_category_id', 'account_categories.id')
      .where({
        'accounts.organization_id': orgId,
        'account_types.name': 'Revenue'
      })
      .select(
        'accounts.id',
        'accounts.code',
        'accounts.name',
        'account_categories.name as categoryName'
      );
    
    // Get expense accounts
    const expenseAccounts = await db('accounts')
      .join('account_types', 'accounts.account_type_id', 'account_types.id')
      .leftJoin('account_categories', 'accounts.account_category_id', 'account_categories.id')
      .where({
        'accounts.organization_id': orgId,
        'account_types.name': 'Expense'
      })
      .select(
        'accounts.id',
        'accounts.code',
        'accounts.name',
        'account_categories.name as categoryName'
      );
    
    // Get revenue transactions for the period
    const revenueAccountIds = revenueAccounts.map(account => account.id);
    let totalRevenue = 0;
    
    if (revenueAccountIds.length > 0) {
      const revenueTransactions = await db('journal_entry_lines')
        .join('journal_entries', 'journal_entry_lines.journal_entry_id', 'journal_entries.id')
        .whereIn('journal_entry_lines.account_id', revenueAccountIds)
        .where('journal_entries.organization_id', orgId)
        .where('journal_entries.status', 'posted')
        .whereBetween('journal_entries.date', [startDate, endDate])
        .select(
          'journal_entry_lines.account_id',
          'journal_entry_lines.debit_amount',
          'journal_entry_lines.credit_amount'
        );
      
      // Calculate revenue by account
      const revenueByAccount = {};
      
      revenueTransactions.forEach(transaction => {
        const accountId = transaction.account_id;
        
        if (!revenueByAccount[accountId]) {
          revenueByAccount[accountId] = 0;
        }
        
        // Revenue accounts have credit normal balance
        revenueByAccount[accountId] += parseFloat(transaction.credit_amount || 0) - parseFloat(transaction.debit_amount || 0);
      });
      
      // Add balances to revenue accounts
      revenueAccounts.forEach(account => {
        account.balance = revenueByAccount[account.id] || 0;
        totalRevenue += account.balance;
      });
    }
    
    // Get expense transactions for the period
    const expenseAccountIds = expenseAccounts.map(account => account.id);
    let totalExpenses = 0;
    
    if (expenseAccountIds.length > 0) {
      const expenseTransactions = await db('journal_entry_lines')
        .join('journal_entries', 'journal_entry_lines.journal_entry_id', 'journal_entries.id')
        .whereIn('journal_entry_lines.account_id', expenseAccountIds)
        .where('journal_entries.organization_id', orgId)
        .where('journal_entries.status', 'posted')
        .whereBetween('journal_entries.date', [startDate, endDate])
        .select(
          'journal_entry_lines.account_id',
          'journal_entry_lines.debit_amount',
          'journal_entry_lines.credit_amount'
        );
      
      // Calculate expenses by account
      const expensesByAccount = {};
      
      expenseTransactions.forEach(transaction => {
        const accountId = transaction.account_id;
        
        if (!expensesByAccount[accountId]) {
          expensesByAccount[accountId] = 0;
        }
        
        // Expense accounts have debit normal balance
        expensesByAccount[accountId] += parseFloat(transaction.debit_amount || 0) - parseFloat(transaction.credit_amount || 0);
      });
      
      // Add balances to expense accounts
      expenseAccounts.forEach(account => {
        account.balance = expensesByAccount[account.id] || 0;
        totalExpenses += account.balance;
      });
    }
    
    // Group revenue accounts by category
    const revenueByCategory = {};
    
    revenueAccounts.forEach(account => {
      const categoryName = account.categoryName || 'Uncategorized';
      
      if (!revenueByCategory[categoryName]) {
        revenueByCategory[categoryName] = {
          name: categoryName,
          accounts: [],
          total: 0
        };
      }
      
      revenueByCategory[categoryName].accounts.push(account);
      revenueByCategory[categoryName].total += account.balance;
    });
    
    // Group expense accounts by category
    const expensesByCategory = {};
    
    expenseAccounts.forEach(account => {
      const categoryName = account.categoryName || 'Uncategorized';
      
      if (!expensesByCategory[categoryName]) {
        expensesByCategory[categoryName] = {
          name: categoryName,
          accounts: [],
          total: 0
        };
      }
      
      expensesByCategory[categoryName].accounts.push(account);
      expensesByCategory[categoryName].total += account.balance;
    });
    
    // Calculate net income
    const netIncome = totalRevenue - totalExpenses;
    
    res.json({
      success: true,
      data: {
        revenue: {
          categories: Object.values(revenueByCategory),
          total: totalRevenue
        },
        expenses: {
          categories: Object.values(expensesByCategory),
          total: totalExpenses
        },
        netIncome,
        period: {
          startDate,
          endDate
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
