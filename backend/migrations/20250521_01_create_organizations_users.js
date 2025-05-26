// Create migration for organizations and users tables
exports.up = function(knex) {
  return knex.schema
    // Organizations table
    .createTable('organizations', table => {
      table.increments('id').primary();
      table.string('name', 255).notNullable();
      table.string('tax_id', 50);
      table.text('address');
      table.string('phone', 50);
      table.string('email', 255);
      table.string('website', 255);
      table.string('logo_url', 255);
      table.string('timezone', 50).defaultTo('UTC');
      table.date('fiscal_year_start');
      table.string('base_currency', 3).defaultTo('USD');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    
    // Users table
    .createTable('users', table => {
      table.increments('id').primary();
      table.string('email', 255).notNullable().unique();
      table.string('password_hash', 255).notNullable();
      table.string('first_name', 100);
      table.string('last_name', 100);
      table.string('phone', 50);
      table.boolean('is_active').defaultTo(true);
      table.timestamp('last_login');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    
    // User-Organization relationship table
    .createTable('user_organizations', table => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
      table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('CASCADE');
      table.string('role', 50).notNullable(); // 'admin', 'accountant', 'viewer', etc.
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.unique(['user_id', 'organization_id']);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('user_organizations')
    .dropTableIfExists('users')
    .dropTableIfExists('organizations');
};
