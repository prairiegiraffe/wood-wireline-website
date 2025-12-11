-- Migration: Add notify_forms column to admin_users
-- Run with: npx wrangler d1 execute submissions-db --remote --file=db/migrations/002-add-notify-forms.sql

-- Add the new column (will fail silently if it already exists)
ALTER TABLE admin_users ADD COLUMN notify_forms TEXT DEFAULT 'none';

-- Verify the column was added
SELECT sql FROM sqlite_master WHERE name = 'admin_users';
