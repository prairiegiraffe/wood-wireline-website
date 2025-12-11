-- Migration: Add superadmin role support
-- Run with: npx wrangler d1 execute submissions-db --remote --file=db/migrations/003-add-superadmin-role.sql

-- Note: SQLite doesn't support ALTER TABLE to modify CHECK constraints
-- The role check will be enforced at application level for existing databases
-- New databases will have the updated schema

-- Update kellee@prairiegiraffe.com to superadmin role
UPDATE admin_users SET role = 'superadmin' WHERE email = 'kellee@prairiegiraffe.com';

-- Verify the update
SELECT id, email, name, role FROM admin_users WHERE email = 'kellee@prairiegiraffe.com';
