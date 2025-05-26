// Create migration for general ledger and account balances tables
exports.up = function(knex) {
  return knex.schema
    // General ledger table
    .createTable('general_ledger', table => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('CASCADE');
      table.integer('fiscal_period_id').unsigned().references('id').inTable('fiscal_periods');
      table.integer('account_id').unsigned().references('id').inTable('accounts');
      table.integer('journal_entry_id').unsigned().references('id').inTable('journal_entries');
      table.integer('journal_entry_item_id').unsigned().references('id').inTable('journal_entry_items');
      table.date('transaction_date').notNullable();
      table.text('description');
      table.decimal('debit_amount', 19, 4).defaultTo(0);
      table.decimal('credit_amount', 19, 4).defaultTo(0);
      table.decimal('balance', 19, 4).notNullable();
      table.string('currency_code', 3).references('code').inTable('currencies');
      table.decimal('base_debit_amount', 19, 4).defaultTo(0);
      table.decimal('base_credit_amount', 19, 4).defaultTo(0);
      table.decimal('base_balance', 19, 4).notNullable();
      table.jsonb('dimensions');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    
    // Create indexes for performance
    .raw('CREATE INDEX general_ledger_organization_account_idx ON general_ledger(organization_id, account_id)')
    .raw('CREATE INDEX general_ledger_fiscal_period_idx ON general_ledger(fiscal_period_id)')
    .raw('CREATE INDEX general_ledger_transaction_date_idx ON general_ledger(transaction_date)')
    
    // Account balances table
    .createTable('account_balances', table => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('CASCADE');
      table.integer('fiscal_period_id').unsigned().references('id').inTable('fiscal_periods');
      table.integer('account_id').unsigned().references('id').inTable('accounts');
      table.decimal('opening_balance', 19, 4).notNullable().defaultTo(0);
      table.decimal('debit_amount', 19, 4).notNullable().defaultTo(0);
      table.decimal('credit_amount', 19, 4).notNullable().defaultTo(0);
      table.decimal('closing_balance', 19, 4).notNullable().defaultTo(0);
      table.string('currency_code', 3).references('code').inTable('currencies');
      table.decimal('base_opening_balance', 19, 4).notNullable().defaultTo(0);
      table.decimal('base_debit_amount', 19, 4).notNullable().defaultTo(0);
      table.decimal('base_credit_amount', 19, 4).notNullable().defaultTo(0);
      table.decimal('base_closing_balance', 19, 4).notNullable().defaultTo(0);
      table.timestamp('last_updated_at').defaultTo(knex.fn.now());
      table.unique(['organization_id', 'fiscal_period_id', 'account_id']);
    });
};

exports.down = function(knex) {
  return knex.schema
    .raw('DROP INDEX IF EXISTS general_ledger_transaction_date_idx')
    .raw('DROP INDEX IF EXISTS general_ledger_fiscal_period_idx')
    .raw('DROP INDEX IF EXISTS general_ledger_organization_account_idx')
    .dropTableIfExists('account_balances')
    .dropTableIfExists('general_ledger');
};
