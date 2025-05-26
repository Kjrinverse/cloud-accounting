// Create migration for fiscal periods tables
exports.up = function(knex) {
  return knex.schema
    // Fiscal years table
    .createTable('fiscal_years', table => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('CASCADE');
      table.string('name', 100).notNullable();
      table.date('start_date').notNullable();
      table.date('end_date').notNullable();
      table.boolean('is_closed').defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.unique(['organization_id', 'name']);
    })
    
    // Fiscal periods table
    .createTable('fiscal_periods', table => {
      table.increments('id').primary();
      table.integer('fiscal_year_id').unsigned().references('id').inTable('fiscal_years').onDelete('CASCADE');
      table.string('name', 100).notNullable();
      table.date('start_date').notNullable();
      table.date('end_date').notNullable();
      table.boolean('is_closed').defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.unique(['fiscal_year_id', 'name']);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('fiscal_periods')
    .dropTableIfExists('fiscal_years');
};
