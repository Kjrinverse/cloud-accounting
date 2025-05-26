// Role-based access control implementation
const db = require('../db');

/**
 * Create default roles for an organization
 * @param {number} organizationId - The organization ID
 * @param {object} trx - Knex transaction object
 */
const createDefaultRoles = async (organizationId, trx) => {
  // Define default roles with permissions
  const defaultRoles = [
    {
      name: 'Admin',
      description: 'Full access to all features',
      permissions: JSON.stringify(['admin']), // Admin permission grants all access
      is_system: true
    },
    {
      name: 'Accountant',
      description: 'Can manage all accounting functions',
      permissions: JSON.stringify([
        'chart_of_accounts:view', 'chart_of_accounts:create', 'chart_of_accounts:edit',
        'journal_entries:view', 'journal_entries:create', 'journal_entries:post',
        'general_ledger:view',
        'reports:view'
      ]),
      is_system: true
    },
    {
      name: 'Bookkeeper',
      description: 'Can enter transactions but cannot post them',
      permissions: JSON.stringify([
        'chart_of_accounts:view',
        'journal_entries:view', 'journal_entries:create',
        'general_ledger:view'
      ]),
      is_system: true
    },
    {
      name: 'Viewer',
      description: 'Can only view data, no editing capabilities',
      permissions: JSON.stringify([
        'chart_of_accounts:view',
        'journal_entries:view',
        'general_ledger:view',
        'reports:view'
      ]),
      is_system: true
    }
  ];

  // Insert roles
  const roleIds = [];
  for (const role of defaultRoles) {
    const [id] = await trx('roles').insert({
      organization_id: organizationId,
      name: role.name,
      description: role.description,
      permissions: role.permissions,
      is_system: role.is_system,
      created_at: new Date(),
      updated_at: new Date()
    }).returning('id');
    
    roleIds.push(id);
  }
  
  return roleIds;
};

/**
 * Assign a role to a user in an organization
 * @param {number} organizationId - The organization ID
 * @param {number} userId - The user ID
 * @param {number} roleId - The role ID
 */
const assignRoleToUser = async (organizationId, userId, roleId) => {
  // Check if user already has a role in this organization
  const existingRole = await db('user_organizations')
    .where({
      organization_id: organizationId,
      user_id: userId
    })
    .first();
  
  if (existingRole) {
    // Update existing role
    await db('user_organizations')
      .where({
        organization_id: organizationId,
        user_id: userId
      })
      .update({
        role_id: roleId,
        updated_at: new Date()
      });
  } else {
    // Create new organization user with role
    await db('user_organizations').insert({
      organization_id: organizationId,
      user_id: userId,
      role_id: roleId,
      created_at: new Date(),
      updated_at: new Date()
    });
  }
};

/**
 * Get all available permissions in the system
 * @returns {Array} Array of permission objects with categories
 */
const getAllPermissions = () => {
  return [
    {
      category: 'Chart of Accounts',
      permissions: [
        { name: 'chart_of_accounts:view', description: 'View chart of accounts' },
        { name: 'chart_of_accounts:create', description: 'Create accounts' },
        { name: 'chart_of_accounts:edit', description: 'Edit accounts' },
        { name: 'chart_of_accounts:delete', description: 'Delete accounts' }
      ]
    },
    {
      category: 'Journal Entries',
      permissions: [
        { name: 'journal_entries:view', description: 'View journal entries' },
        { name: 'journal_entries:create', description: 'Create journal entries' },
        { name: 'journal_entries:edit', description: 'Edit draft journal entries' },
        { name: 'journal_entries:delete', description: 'Delete draft journal entries' },
        { name: 'journal_entries:post', description: 'Post journal entries' }
      ]
    },
    {
      category: 'General Ledger',
      permissions: [
        { name: 'general_ledger:view', description: 'View general ledger' }
      ]
    },
    {
      category: 'Reports',
      permissions: [
        { name: 'reports:view', description: 'View financial reports' },
        { name: 'reports:export', description: 'Export reports' }
      ]
    },
    {
      category: 'Organization',
      permissions: [
        { name: 'organization:view', description: 'View organization details' },
        { name: 'organization:edit', description: 'Edit organization details' },
        { name: 'organization:users:view', description: 'View organization users' },
        { name: 'organization:users:manage', description: 'Manage organization users' }
      ]
    },
    {
      category: 'Settings',
      permissions: [
        { name: 'settings:view', description: 'View settings' },
        { name: 'settings:edit', description: 'Edit settings' }
      ]
    },
    {
      category: 'Admin',
      permissions: [
        { name: 'admin', description: 'Full administrative access' }
      ]
    }
  ];
};

module.exports = {
  createDefaultRoles,
  assignRoleToUser,
  getAllPermissions
};
