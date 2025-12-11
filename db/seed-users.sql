-- Admin Users Seed Data
-- Run with: npx wrangler d1 execute submissions-db --remote --file=db/seed-users.sql

-- Delete existing users (for fresh start)
DELETE FROM sessions;
DELETE FROM admin_users;

-- 1. Super Admin (Kellee) - agency role, sees EVERYTHING
-- Password: PrairieGiraffe2025
INSERT INTO admin_users (email, password_hash, name, role, tenant_id, is_active)
VALUES (
  'kellee@prairiegiraffe.com',
  '100000:79ad4c1bdbc6f7422ca8540902d15d96:e4f1bb4f4afa3efd45f7ff3efd15349fd0ac28b528c5a7a0d9720995d880751b790b2bee0dfc92c548111463e22b977bdfcbc53b059c21746204d9782272d567',
  'Kellee Carroll',
  'agency',
  NULL,
  1
);

-- 2. Kut Thru Media - agency role, sees agency copies
-- Password: KutThru2025
INSERT INTO admin_users (email, password_hash, name, role, tenant_id, is_active)
VALUES (
  'admin@kutthrumedia.com',
  '100000:8bc59465f8709a923e72e6c0076cbaf9:b7a081503e9814ad409a4916bf18d1d015f2774d5f6ce6278e0dc0d931613ee59f8afa2aec3dd9c19a4472207777e68c037929335443e250ef819a6744dd3aeb',
  'Kut Thru Media',
  'agency',
  NULL,
  1
);

-- 3. Wood Wireline Admin - admin role, sees only wood_wireline tenant data
-- Password: WoodWireline2025
INSERT INTO admin_users (email, password_hash, name, role, tenant_id, is_active)
VALUES (
  'admin@woodwireline.com',
  '100000:a1d56cc0aeab59554a344043ff1ce1f9:0e0880b050029a502833530be25413116c91a45179365e84b01608835eac3594ee9d2a7f94f89f95683f7f3b2b97894023623519ed238dd05f7b7921e45a5d20',
  'Wood Wireline Admin',
  'admin',
  'wood_wireline',
  1
);

-- Verify users created
SELECT id, email, name, role, tenant_id FROM admin_users;
