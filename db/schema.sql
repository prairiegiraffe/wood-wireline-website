-- Cloudflare D1 Database Schema for Form Submissions CMS
-- Multi-tenant with agency copy support

-- ============================================
-- SUBMISSIONS TABLE
-- ============================================
-- Stores all form submissions (contact + application)
-- Each submission creates TWO records: client copy + agency copy

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Multi-tenancy
  tenant_id TEXT NOT NULL,              -- e.g., 'wood_wireline', 'mtn_mud'
  is_agency_copy INTEGER NOT NULL DEFAULT 0,  -- 0 = client's copy, 1 = agency's immutable copy

  -- Form identification
  form_type TEXT NOT NULL CHECK (form_type IN ('contact', 'application')),

  -- Status tracking (only affects client's copy)
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'contacted', 'hired', 'archived')),

  -- Common fields (all forms)
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,

  -- Application-specific fields (NULL for contact forms)
  dob TEXT,
  location TEXT,
  experience TEXT,
  cdl TEXT,
  resume_key TEXT,           -- R2 object key for resume file
  resume_filename TEXT,      -- Original filename
  resume_size INTEGER,       -- File size in bytes

  -- Metadata
  source TEXT,
  page_url TEXT,
  ip_address TEXT,
  user_agent TEXT,

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,

  -- Admin notes (only on client's copy)
  admin_notes TEXT,

  -- Soft delete (only affects client's view)
  deleted_at TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_submissions_tenant ON submissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_submissions_agency ON submissions(is_agency_copy);
CREATE INDEX IF NOT EXISTS idx_submissions_form_type ON submissions(form_type);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_tenant_deleted ON submissions(tenant_id, deleted_at);

-- ============================================
-- ADMIN USERS TABLE
-- ============================================
-- Users who can access the admin dashboard

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Multi-tenancy: NULL = agency (sees all), otherwise tenant-specific
  tenant_id TEXT,

  -- User info
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,

  -- Role: 'superadmin' invisible god mode, 'agency' can see all tenants, 'admin' sees own tenant, 'viewer' read-only
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('superadmin', 'agency', 'admin', 'viewer')),

  -- Email notification preferences: 'none', 'contact', 'application', 'all'
  notify_forms TEXT NOT NULL DEFAULT 'none' CHECK (notify_forms IN ('none', 'contact', 'application', 'all')),

  -- Status
  is_active INTEGER NOT NULL DEFAULT 1,

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_tenant ON admin_users(tenant_id);

-- ============================================
-- SESSIONS TABLE
-- ============================================
-- Active login sessions

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,           -- JWT ID (jti)
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ============================================
-- EMAIL LOG TABLE
-- ============================================
-- Track notification emails sent

CREATE TABLE IF NOT EXISTS email_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  submission_id INTEGER,
  tenant_id TEXT NOT NULL,

  -- Email details
  from_address TEXT NOT NULL,
  to_addresses TEXT NOT NULL,    -- JSON array of recipients
  subject TEXT NOT NULL,

  -- Status
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  error_message TEXT,
  message_id TEXT,               -- SES message ID if successful

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT,

  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_email_log_submission ON email_log(submission_id);
CREATE INDEX IF NOT EXISTS idx_email_log_tenant ON email_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_log_status ON email_log(status);

-- ============================================
-- TENANTS TABLE (for agency use)
-- ============================================
-- Track all client tenants

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,           -- e.g., 'wood_wireline'
  name TEXT NOT NULL,            -- e.g., 'Wood Wireline Service Inc'
  domain TEXT,                   -- e.g., 'woodwireline.com'

  -- Email settings
  notification_emails TEXT,      -- JSON array of emails to notify
  from_email TEXT,               -- e.g., 'noreply@woodwireline.com'

  -- Status
  is_active INTEGER NOT NULL DEFAULT 1,

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
