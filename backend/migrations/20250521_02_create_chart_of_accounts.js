// Create migration for chart of accounts tables
exports.up = function(knex) {
  return knex.schema
    // Account types table
    .createTable('account_types', table => {
      table.increments('id').primary();
      table.string('name', 50).notNullable().unique();
      table.string('normal_balance', 5).notNullable(); // 'debit' or 'credit'
      table.text('description');
    })
    
    // Account categories table
    .createTable('account_categories', table => {
      table.increments('id').primary();
      table.string('name', 100).notNullable();
      table.integer('account_type_id').unsigned().references('id').inTable('account_types');
      table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('CASCADE');
      table.text('description');
      table.unique(['name', 'organization_id']);
    })
    
    // Accounts table
    .createTable('accounts', table => {
      table.increments('id').primary();
      table.string('code', 20).notNullable();
      table.string('name', 255).notNullable();
      table.text('description');
      table.integer('account_type_id').unsigned().references('id').inTable('account_types');
      table.integer('account_category_id').unsigned().references('id').inTable('account_categories');
      table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('CASCADE');
      table.integer('parent_account_id').unsigned().references('id').inTable('accounts');
      table.boolean('is_active').defaultTo(true);
      table.boolean('is_bank_account').defaultTo(false);
      table.jsonb('bank_account_details');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.unique(['code', 'organization_id']);
    })
    
    // Create index for hierarchical queries
    .raw('CREATE INDEX accounts_parent_account_id_idx ON accounts(parent_account_id)');
};

exports.down = function(knex) {
  return knex.schema
    .raw('DROP INDEX IF EXISTS accounts_parent_account_id_idx')
    .dropTableIfExists('accounts')
    .dropTableIfExists('account_categories')
    .dropTableIfExists('account_types');
};
