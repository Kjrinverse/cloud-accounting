// Create migration for financial reports and AI integration tables
exports.up = function(knex) {
  return knex.schema
    // Report templates table
    .createTable('report_templates', table => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('CASCADE');
      table.string('name', 255).notNullable();
      table.string('type', 50).notNullable(); // 'balance_sheet', 'income_statement', 'cash_flow', 'custom'
      table.text('description');
      table.jsonb('config').notNullable(); // Report configuration including rows, columns, formulas, etc.
      table.boolean('is_system').defaultTo(false); // System templates vs user-created
      table.integer('created_by').unsigned().references('id').inTable('users');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.unique(['organization_id', 'name']);
    })
    
    // Report instances table
    .createTable('report_instances', table => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('CASCADE');
      table.integer('template_id').unsigned().references('id').inTable('report_templates');
      table.string('name', 255).notNullable();
      table.jsonb('parameters').notNullable(); // Date range, comparison periods, etc.
      table.jsonb('data'); // Cached report data
      table.integer('created_by').unsigned().references('id').inTable('users');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    
    // AI models table
    .createTable('ai_models', table => {
      table.increments('id').primary();
      table.string('name', 100).notNullable();
      table.string('provider', 50).notNullable(); // 'openai', 'internal', etc.
      table.string('model_id', 100).notNullable(); // e.g., 'gpt-4', 'text-davinci-003'
      table.text('description');
      table.jsonb('capabilities'); // What this model can do
      table.jsonb('config'); // Configuration parameters
      table.boolean('is_active').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    
    // AI assistants table
    .createTable('ai_assistants', table => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('CASCADE');
      table.string('name', 100).notNullable();
      table.text('description');
      table.integer('ai_model_id').unsigned().references('id').inTable('ai_models');
      table.jsonb('capabilities'); // Specific capabilities enabled for this assistant
      table.jsonb('config'); // Assistant-specific configuration
      table.boolean('is_active').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.unique(['organization_id', 'name']);
    })
    
    // AI interactions table
    .createTable('ai_interactions', table => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('CASCADE');
      table.integer('user_id').unsigned().references('id').inTable('users');
      table.integer('assistant_id').unsigned().references('id').inTable('ai_assistants');
      table.uuid('session_id').notNullable();
      table.text('query').notNullable();
      table.text('response');
      table.jsonb('context'); // Context provided to the AI
      table.jsonb('metadata'); // Additional metadata about the interaction
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    
    // AI suggestions table
    .createTable('ai_suggestions', table => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('CASCADE');
      table.integer('user_id').unsigned().references('id').inTable('users');
      table.integer('assistant_id').unsigned().references('id').inTable('ai_assistants');
      table.string('entity_type', 50).notNullable(); // 'journal_entry', 'account', 'report', etc.
      table.integer('entity_id'); // ID of the related entity
      table.text('suggestion').notNullable();
      table.text('explanation');
      table.decimal('confidence', 5, 2); // Confidence score (0-100)
      table.boolean('is_applied').defaultTo(false);
      table.timestamp('applied_at');
      table.integer('applied_by').unsigned().references('id').inTable('users');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    
    // Activity logs table
    .createTable('activity_logs', table => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('CASCADE');
      table.integer('user_id').unsigned().references('id').inTable('users');
      table.string('action', 50).notNullable(); // 'create', 'update', 'delete', 'view', etc.
      table.string('entity_type', 50).notNullable(); // 'journal_entry', 'account', 'report', etc.
      table.integer('entity_id'); // ID of the related entity
      table.text('description');
      table.jsonb('changes'); // Before/after values for updates
      table.string('ip_address', 45);
      table.text('user_agent');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    
    // Create indexes for activity logs
    .raw('CREATE INDEX activity_logs_organization_entity_idx ON activity_logs(organization_id, entity_type, entity_id)')
    .raw('CREATE INDEX activity_logs_user_idx ON activity_logs(user_id)')
    .raw('CREATE INDEX activity_logs_created_at_idx ON activity_logs(created_at)');
};

exports.down = function(knex) {
  return knex.schema
    .raw('DROP INDEX IF EXISTS activity_logs_created_at_idx')
    .raw('DROP INDEX IF EXISTS activity_logs_user_idx')
    .raw('DROP INDEX IF EXISTS activity_logs_organization_entity_idx')
    .dropTableIfExists('activity_logs')
    .dropTableIfExists('ai_suggestions')
    .dropTableIfExists('ai_interactions')
    .dropTableIfExists('ai_assistants')
    .dropTableIfExists('ai_models')
    .dropTableIfExists('report_instances')
    .dropTableIfExists('report_templates');
};
