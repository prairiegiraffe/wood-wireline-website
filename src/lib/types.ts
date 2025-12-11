// Cloudflare Environment Types

export interface CloudflareEnv {
  // D1 Database
  DB: D1Database;

  // R2 Storage
  STORAGE: R2Bucket;

  // Environment variables
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_REGION: string;
  JWT_SECRET: string;
  SITE_URL: string;
  NOTIFICATION_EMAILS: string;
  TENANT_ID: string;
}

// Extend Astro's locals
declare global {
  namespace App {
    interface Locals {
      runtime: {
        env: CloudflareEnv;
      };
      user?: AdminUser;
    }
  }
}

// Database Types

export interface Submission {
  id: number;
  tenant_id: string;
  is_agency_copy: number;
  form_type: 'contact' | 'application';
  status: 'new' | 'reviewed' | 'contacted' | 'hired' | 'archived';
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  dob: string | null;
  location: string | null;
  experience: string | null;
  cdl: string | null;
  resume_key: string | null;
  resume_filename: string | null;
  resume_size: number | null;
  source: string | null;
  page_url: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  admin_notes: string | null;
  deleted_at: string | null;
}

export interface AdminUser {
  id: number;
  tenant_id: string | null;
  email: string;
  password_hash: string;
  name: string;
  role: 'superadmin' | 'agency' | 'admin' | 'viewer';
  notify_forms: 'none' | 'contact' | 'application' | 'all';
  is_active: number;
  created_at: string;
  last_login: string | null;
}

export interface Session {
  id: string;
  user_id: number;
  expires_at: string;
  created_at: string;
}

export interface Tenant {
  id: string;
  name: string;
  domain: string | null;
  notification_emails: string | null;
  from_email: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface EmailLog {
  id: number;
  submission_id: number | null;
  tenant_id: string;
  from_address: string;
  to_addresses: string;
  subject: string;
  status: 'sent' | 'failed' | 'pending';
  error_message: string | null;
  message_id: string | null;
  created_at: string;
  sent_at: string | null;
}

// API Types

export interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  message: string;
  page_url?: string;
}

export interface ApplicationFormData {
  name: string;
  email: string;
  phone: string;
  dob: string;
  location: string;
  experience: string;
  cdl: string;
  page_url?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// JWT Payload
export interface JWTPayload {
  sub: string; // user id
  email: string;
  name: string;
  role: 'superadmin' | 'agency' | 'admin' | 'viewer';
  tenant_id: string | null;
  jti: string; // session id
  iat: number;
  exp: number;
}
