// Create migration for journal entries tables
exports.up = function(knex) {
  return knex.schema
    // Currencies table
    .createTable('currencies', table => {
      table.string('code', 3).primary();
      table.string('name', 100).notNullable();
      table.string('symbol', 10).notNullable();
      table.integer('decimal_places').defaultTo(2);
    })
    
    // Exchange rates table
    .createTable('exchange_rates', table => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('CASCADE');
      table.string('from_currency', 3).references('code').inTable('currencies');
      table.string('to_currency', 3).references('code').inTable('currencies');
      table.decimal('rate', 19, 6).notNullable();
      table.date('effective_date').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.unique(['organization_id', 'from_currency', 'to_currency', 'effective_date']);
    })
    
    // Journal entries table
    .createTable('journal_entries', table => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('CASCADE');
      table.string('entry_no', 50).notNullable();
      table.date('entry_date').notNullable();
      table.integer('fiscal_period_id').unsigned().references('id').inTable('fiscal_periods');
      table.text('description');
      table.string('reference', 100);
      table.string('source', 50); // 'manual', 'import', 'recurring', 'system', etc.
      table.string('status', 20).defaultTo('draft'); // 'draft', 'posted', 'voided'
      table.string('currency_code', 3).references('code').inTable('currencies');
      table.decimal('exchange_rate', 19, 6).defaultTo(1.0);
      table.integer('created_by').unsigned().references('id').inTable('users');
      table.integer('approved_by').unsigned().references('id').inTable('users');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.timestamp('posted_at');
      table.unique(['organization_id', 'entry_no']);
    })
    
    // Journal entry items table
    .createTable('journal_entry_items', table => {
      table.increments('id').primary();
      table.integer('journal_entry_id').unsigned().references('id').inTable('journal_entries').onDelete('CASCADE');
      table.integer('account_id').unsigned().references('id').inTable('accounts');
      table.text('description');
      table.decimal('debit_amount', 19, 4).defaultTo(0);
      table.decimal('credit_amount', 19, 4).defaultTo(0);
      table.decimal('base_debit_amount', 19, 4).defaultTo(0);
      table.decimal('base_credit_amount', 19, 4).defaultTo(0);
      table.text('memo');
      table.jsonb('dimensions');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      // Add check constraints
      table.check('debit_amount >= 0 AND credit_amount >= 0');
      table.check('debit_amount = 0 OR credit_amount = 0');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('journal_entry_items')
    .dropTableIfExists('journal_entries')
    .dropTableIfExists('exchange_rates')
    .dropTableIfExists('currencies');
};
