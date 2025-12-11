-- Migration: Recreate admin_users table to add superadmin role to CHECK constraint
-- Run with: npx wrangler d1 execute submissions-db --remote --file=db/migrations/004-recreate-admin-users-with-superadmin.sql

-- Step 1: Create new table with updated CHECK constraint
CREATE TABLE admin_users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('superadmin', 'agency', 'admin', 'viewer')),
  notify_forms TEXT NOT NULL DEFAULT 'none' CHECK (notify_forms IN ('none', 'contact', 'application', 'all')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT
);

-- Step 2: Copy existing data
INSERT INTO admin_users_new (id, tenant_id, email, password_hash, name, role, notify_forms, is_active, created_at, last_login)
SELECT id, tenant_id, email, password_hash, name, role, COALESCE(notify_forms, 'none'), is_active, created_at, last_login
FROM admin_users;

-- Step 3: Drop old table
DROP TABLE admin_users;

-- Step 4: Rename new table
ALTER TABLE admin_users_new RENAME TO admin_users;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_tenant ON admin_users(tenant_id);

-- Step 6: Verify schema
SELECT sql FROM sqlite_master WHERE name = 'admin_users';
