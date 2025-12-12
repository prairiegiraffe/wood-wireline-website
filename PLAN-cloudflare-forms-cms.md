# Implementation Plan: Cloudflare-Native Form Submissions CMS

## Overview

Replace Make.com + Google Sheets with an in-house solution using Cloudflare D1 (database), R2 (file storage), and Pages Functions (API). This creates a reusable pattern for all Astro sites.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Browser                                 │
└─────────────────────────────────────────────────────────────────────┘
                    │                           │
                    │ Contact Form              │ Application Form
                    │ (JSON)                    │ (multipart/form-data)
                    ▼                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Cloudflare Pages Functions                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │
│  │ /api/contact    │  │ /api/apply      │  │ /api/admin/*        │  │
│  │ POST            │  │ POST            │  │ GET/POST (protected)│  │
│  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘  │
└───────────┼────────────────────┼─────────────────────┼──────────────┘
            │                    │                     │
            ▼                    ▼                     ▼
┌───────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐
│  Cloudflare D1    │  │  Cloudflare R2  │  │  Email (Resend API)     │
│  - submissions    │  │  - resumes/     │  │  - Notifications        │
│  - admin_users    │  │  - uploads/     │  │                         │
│  - sessions       │  │                 │  │                         │
└───────────────────┘  └─────────────────┘  └─────────────────────────┘
```

---

## Phase 1: Infrastructure Setup

### 1.1 Switch Astro to Hybrid/Server Mode

**File: `astro.config.ts`**

```typescript
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'hybrid', // or 'server' for full SSR
  adapter: cloudflare(),
  // ... rest of config
});
```

### 1.2 Create Wrangler Configuration

**File: `wrangler.toml`**

```toml
name = "wood-wireline-website"
compatibility_date = "2025-01-01"
pages_build_output_dir = "./dist"

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "submissions-db"
database_id = "<your-database-id>"

# R2 Storage
[[r2_buckets]]
binding = "STORAGE"
bucket_name = "submissions-files"

# Environment Variables (set in Cloudflare Dashboard)
# RESEND_API_KEY - for email notifications
# ADMIN_PASSWORD_HASH - hashed admin password
# JWT_SECRET - for session tokens
```

### 1.3 Create D1 Database

**File: `db/schema.sql`**

```sql
-- Submissions table (both contact and application forms)
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  form_type TEXT NOT NULL CHECK (form_type IN ('contact', 'application')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'contacted', 'archived')),

  -- Common fields
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,

  -- Application-specific fields (NULL for contact forms)
  dob TEXT,
  location TEXT,
  experience TEXT,
  cdl TEXT,
  resume_url TEXT,
  resume_filename TEXT,

  -- Metadata
  source TEXT,
  page_url TEXT,
  ip_address TEXT,
  user_agent TEXT,

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,

  -- Notes from admin
  admin_notes TEXT
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_submissions_form_type ON submissions(form_type);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at DESC);

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'viewer')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT
);

-- Sessions table (for JWT blacklist/refresh)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES admin_users(id)
);

-- Email notifications log
CREATE TABLE IF NOT EXISTS email_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error_message TEXT,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (submission_id) REFERENCES submissions(id)
);
```

---

## Phase 2: API Endpoints

### 2.1 Project Structure

```
src/
├── pages/
│   ├── api/
│   │   ├── contact.ts          # POST - handle contact form
│   │   ├── apply.ts            # POST - handle application form
│   │   ├── admin/
│   │   │   ├── login.ts        # POST - admin login
│   │   │   ├── logout.ts       # POST - admin logout
│   │   │   ├── submissions.ts  # GET - list submissions
│   │   │   ├── submission/
│   │   │   │   └── [id].ts     # GET/PATCH - view/update submission
│   │   │   └── stats.ts        # GET - dashboard stats
│   │   └── health.ts           # GET - health check
│   ├── admin/
│   │   ├── index.astro         # Dashboard
│   │   ├── login.astro         # Login page
│   │   └── submissions/
│   │       ├── index.astro     # Submissions list
│   │       └── [id].astro      # Single submission view
├── lib/
│   ├── db.ts                   # D1 database helpers
│   ├── storage.ts              # R2 storage helpers
│   ├── auth.ts                 # JWT auth helpers
│   ├── email.ts                # Resend email helpers
│   └── types.ts                # TypeScript types
└── middleware.ts               # Auth middleware for admin routes
```

### 2.2 Contact Form Endpoint

**File: `src/pages/api/contact.ts`**

```typescript
import type { APIRoute } from 'astro';
import { sendNotificationEmail } from '~/lib/email';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const data = await request.json();

    // Validate required fields
    if (!data.name || !data.email || !data.message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get Cloudflare bindings
    const { DB } = locals.runtime.env;

    // Insert into database
    const result = await DB.prepare(
      `
      INSERT INTO submissions (
        form_type, name, email, phone, message,
        source, page_url, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
      .bind(
        'contact',
        data.name,
        data.email,
        data.phone || null,
        data.message,
        data.source || 'Website Contact Form',
        data.page_url || null,
        request.headers.get('CF-Connecting-IP'),
        request.headers.get('User-Agent')
      )
      .run();

    // Send notification email (async, don't wait)
    sendNotificationEmail(locals.runtime.env, {
      type: 'contact',
      name: data.name,
      email: data.email,
      submissionId: result.meta.last_row_id,
    }).catch(console.error);

    return new Response(
      JSON.stringify({
        success: true,
        id: result.meta.last_row_id,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Contact form error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
```

### 2.3 Application Form Endpoint (with file upload)

**File: `src/pages/api/apply.ts`**

```typescript
import type { APIRoute } from 'astro';
import { uploadFile } from '~/lib/storage';
import { sendNotificationEmail } from '~/lib/email';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const formData = await request.formData();
    const { DB, STORAGE } = locals.runtime.env;

    // Extract form fields
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    const dob = formData.get('dob') as string;
    const location = formData.get('location') as string;
    const experience = formData.get('experience') as string;
    const cdl = formData.get('cdl') as string;
    const resumeFile = formData.get('resume') as File;

    // Validate required fields
    if (!name || !email || !phone) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Upload resume to R2 if provided
    let resumeUrl = null;
    let resumeFilename = null;

    if (resumeFile && resumeFile.size > 0) {
      // Validate file size (5MB max)
      if (resumeFile.size > 5 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: 'Resume file too large (max 5MB)' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const ext = resumeFile.name.split('.').pop();
      const key = `resumes/${timestamp}-${safeName}.${ext}`;

      // Upload to R2
      await STORAGE.put(key, resumeFile.stream(), {
        httpMetadata: {
          contentType: resumeFile.type,
        },
        customMetadata: {
          originalName: resumeFile.name,
          uploadedBy: email,
        },
      });

      resumeUrl = key;
      resumeFilename = resumeFile.name;
    }

    // Insert into database
    const result = await DB.prepare(
      `
      INSERT INTO submissions (
        form_type, name, email, phone, dob, location,
        experience, cdl, resume_url, resume_filename,
        source, page_url, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
      .bind(
        'application',
        name,
        email,
        phone,
        dob,
        location,
        experience,
        cdl,
        resumeUrl,
        resumeFilename,
        'Website Application Form',
        formData.get('page_url') || null,
        request.headers.get('CF-Connecting-IP'),
        request.headers.get('User-Agent')
      )
      .run();

    // Send notification email
    sendNotificationEmail(locals.runtime.env, {
      type: 'application',
      name,
      email,
      location,
      submissionId: result.meta.last_row_id,
    }).catch(console.error);

    return new Response(
      JSON.stringify({
        success: true,
        id: result.meta.last_row_id,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Application form error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
```

### 2.4 Email Notification Helper

**File: `src/lib/email.ts`**

```typescript
interface NotificationData {
  type: 'contact' | 'application';
  name: string;
  email: string;
  location?: string;
  submissionId: number;
}

export async function sendNotificationEmail(env: { RESEND_API_KEY: string }, data: NotificationData) {
  const subject =
    data.type === 'contact' ? `New Contact Form Submission from ${data.name}` : `New Job Application from ${data.name}`;

  const body =
    data.type === 'contact'
      ? `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${data.name}</p>
      <p><strong>Email:</strong> ${data.email}</p>
      <p><a href="https://woodwireline.com/admin/submissions/${data.submissionId}">View in Admin</a></p>
    `
      : `
      <h2>New Job Application</h2>
      <p><strong>Name:</strong> ${data.name}</p>
      <p><strong>Email:</strong> ${data.email}</p>
      <p><strong>Preferred Location:</strong> ${data.location || 'Not specified'}</p>
      <p><a href="https://woodwireline.com/admin/submissions/${data.submissionId}">View Full Application</a></p>
    `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Wood Wireline <noreply@woodwireline.com>',
      to: ['hr@woodwireline.com'], // Client notification
      subject,
      html: body,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send email: ${response.statusText}`);
  }

  return response.json();
}
```

---

## Phase 3: Admin Dashboard

### 3.1 Authentication Middleware

**File: `src/middleware.ts`**

```typescript
import { defineMiddleware } from 'astro:middleware';
import { verifyToken } from '~/lib/auth';

export const onRequest = defineMiddleware(async ({ request, locals, redirect }, next) => {
  const url = new URL(request.url);

  // Only protect /admin routes (except login)
  if (url.pathname.startsWith('/admin') && !url.pathname.includes('/login')) {
    const token = request.headers.get('cookie')?.match(/admin_token=([^;]+)/)?.[1];

    if (!token) {
      return redirect('/admin/login');
    }

    try {
      const payload = await verifyToken(token, locals.runtime.env.JWT_SECRET);
      locals.user = payload;
    } catch {
      return redirect('/admin/login');
    }
  }

  return next();
});
```

### 3.2 Simple Admin Login

**File: `src/pages/admin/login.astro`**

```astro
---
export const prerender = false;

// If already logged in, redirect to dashboard
const token = Astro.cookies.get('admin_token');
if (token) {
  return Astro.redirect('/admin');
}
---

<html>
  <head>
    <title>Admin Login - Wood Wireline</title>
  </head>
  <body class="bg-gray-100 min-h-screen flex items-center justify-center">
    <div class="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
      <h1 class="text-2xl font-bold mb-6">Admin Login</h1>

      <form id="login-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">Email</label>
          <input type="email" name="email" required class="w-full px-4 py-2 border rounded-lg" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Password</label>
          <input type="password" name="password" required class="w-full px-4 py-2 border rounded-lg" />
        </div>
        <button type="submit" class="w-full bg-primary text-white py-2 rounded-lg"> Sign In </button>
      </form>

      <p id="error" class="text-red-500 mt-4 hidden"></p>
    </div>

    <script>
      document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);

        try {
          const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: formData.get('email'),
              password: formData.get('password'),
            }),
          });

          if (response.ok) {
            window.location.href = '/admin';
          } else {
            document.getElementById('error')!.textContent = 'Invalid credentials';
            document.getElementById('error')!.classList.remove('hidden');
          }
        } catch {
          document.getElementById('error')!.textContent = 'Login failed';
          document.getElementById('error')!.classList.remove('hidden');
        }
      });
    </script>
  </body>
</html>
```

### 3.3 Admin Dashboard

**File: `src/pages/admin/index.astro`**

```astro
---
export const prerender = false;

const { DB } = Astro.locals.runtime.env;

// Get stats
const stats = await DB.prepare(
  `
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_count,
    SUM(CASE WHEN form_type = 'contact' THEN 1 ELSE 0 END) as contacts,
    SUM(CASE WHEN form_type = 'application' THEN 1 ELSE 0 END) as applications
  FROM submissions
  WHERE created_at > datetime('now', '-30 days')
`
).first();

// Get recent submissions
const recentSubmissions = await DB.prepare(
  `
  SELECT id, form_type, name, email, status, created_at
  FROM submissions
  ORDER BY created_at DESC
  LIMIT 10
`
).all();
---

<html>
  <head>
    <title>Admin Dashboard - Wood Wireline</title>
  </head>
  <body class="bg-gray-100">
    <nav class="bg-gray-900 text-white p-4">
      <div class="max-w-7xl mx-auto flex justify-between">
        <h1 class="font-bold">Wood Wireline Admin</h1>
        <a href="/api/admin/logout" class="text-gray-300 hover:text-white">Logout</a>
      </div>
    </nav>

    <main class="max-w-7xl mx-auto p-6">
      <!-- Stats Cards -->
      <div class="grid md:grid-cols-4 gap-6 mb-8">
        <div class="bg-white p-6 rounded-lg shadow">
          <p class="text-gray-500 text-sm">New (Last 30 Days)</p>
          <p class="text-3xl font-bold text-primary">{stats?.new_count || 0}</p>
        </div>
        <div class="bg-white p-6 rounded-lg shadow">
          <p class="text-gray-500 text-sm">Total Submissions</p>
          <p class="text-3xl font-bold">{stats?.total || 0}</p>
        </div>
        <div class="bg-white p-6 rounded-lg shadow">
          <p class="text-gray-500 text-sm">Contact Forms</p>
          <p class="text-3xl font-bold">{stats?.contacts || 0}</p>
        </div>
        <div class="bg-white p-6 rounded-lg shadow">
          <p class="text-gray-500 text-sm">Applications</p>
          <p class="text-3xl font-bold">{stats?.applications || 0}</p>
        </div>
      </div>

      <!-- Recent Submissions -->
      <div class="bg-white rounded-lg shadow">
        <div class="p-6 border-b">
          <h2 class="text-xl font-bold">Recent Submissions</h2>
        </div>
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th class="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody class="divide-y">
            {
              recentSubmissions.results?.map((sub: any) => (
                <tr>
                  <td class="px-6 py-4">
                    <span
                      class={`px-2 py-1 rounded text-xs ${sub.form_type === 'application' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}
                    >
                      {sub.form_type}
                    </span>
                  </td>
                  <td class="px-6 py-4">{sub.name}</td>
                  <td class="px-6 py-4">{sub.email}</td>
                  <td class="px-6 py-4">
                    <span
                      class={`px-2 py-1 rounded text-xs ${sub.status === 'new' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100'}`}
                    >
                      {sub.status}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-500">{new Date(sub.created_at).toLocaleDateString()}</td>
                  <td class="px-6 py-4">
                    <a href={`/admin/submissions/${sub.id}`} class="text-primary hover:underline">
                      View
                    </a>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </main>
  </body>
</html>
```

---

## Phase 4: Update Forms to Use New API

### 4.1 Update Contact Form

**File: `src/components/ui/Form.astro`** (script section)

Replace the Make.com webhook call with:

```typescript
const response = await fetch('/api/contact', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});
```

### 4.2 Update Application Form

**File: `src/pages/apply.astro`** (script section)

Replace with multipart/form-data submission:

```typescript
async function submitApplication(form: HTMLFormElement) {
  const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
  const originalButtonText = submitButton?.textContent || 'Submit Application';

  try {
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Submitting...';
    }

    // Send as FormData (not JSON) for file upload
    const formData = new FormData(form);
    formData.append('page_url', window.location.href);

    const response = await fetch('/api/apply', {
      method: 'POST',
      body: formData, // No Content-Type header - browser sets it with boundary
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to submit application');
    }

    alert('Thank you for your application! We will review it and contact you soon.');
    form.reset();
  } catch (error) {
    console.error('Application submission error:', error);
    alert('There was an error submitting your application. Please try again or call us at 307-682-0143.');
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  }
}
```

---

## Phase 5: Deployment Checklist

### 5.1 Cloudflare Setup (One-time)

1. **Create D1 Database:**

   ```bash
   wrangler d1 create submissions-db
   ```

2. **Create R2 Bucket:**

   ```bash
   wrangler r2 bucket create submissions-files
   ```

3. **Run Database Migrations:**

   ```bash
   wrangler d1 execute submissions-db --file=./db/schema.sql
   ```

4. **Create Initial Admin User:**

   ```bash
   wrangler d1 execute submissions-db --command="INSERT INTO admin_users (email, password_hash, name) VALUES ('admin@woodwireline.com', '<bcrypt_hash>', 'Admin')"
   ```

5. **Set Environment Variables in Cloudflare Dashboard:**
   - `RESEND_API_KEY` - Your Resend API key
   - `JWT_SECRET` - Random 32+ character string
   - `ADMIN_SITE_URL` - https://woodwireline.com

### 5.2 Dependencies to Add

```bash
npm install @astrojs/cloudflare
npm install bcryptjs        # For password hashing
npm install jose            # For JWT handling
```

### 5.3 Package.json Scripts Update

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "wrangler pages dev ./dist --d1=DB --r2=STORAGE",
    "db:migrate": "wrangler d1 execute submissions-db --file=./db/schema.sql",
    "db:seed": "wrangler d1 execute submissions-db --file=./db/seed.sql"
  }
}
```

---

## Reusability for Other Projects

This pattern is designed to be portable:

1. **Copy the structure:**
   - `src/pages/api/` endpoints
   - `src/pages/admin/` pages
   - `src/lib/` helpers
   - `db/schema.sql`
   - `wrangler.toml`

2. **Customize:**
   - Form fields in schema
   - Email templates
   - Admin UI branding

3. **Deploy:**
   - Create new D1/R2 in Cloudflare
   - Update wrangler.toml with new IDs
   - Set environment variables

---

## Cost Estimate (Cloudflare Free Tier)

| Service | Free Tier                  | Expected Usage      |
| ------- | -------------------------- | ------------------- |
| D1      | 5GB storage, 5M reads/day  | Well under          |
| R2      | 10GB storage, 10M reads/mo | ~50MB/month resumes |
| Pages   | Unlimited requests         | Covered             |
| Workers | 100K requests/day          | Well under          |

**Total Monthly Cost: $0** (for typical small business usage)

---

## Timeline Estimate

| Phase                     | Effort    |
| ------------------------- | --------- |
| Phase 1: Infrastructure   | 1-2 hours |
| Phase 2: API Endpoints    | 2-3 hours |
| Phase 3: Admin Dashboard  | 3-4 hours |
| Phase 4: Form Updates     | 1 hour    |
| Phase 5: Testing & Deploy | 1-2 hours |

**Total: ~8-12 hours of focused development**

---

## Questions Before Proceeding

1. **Email recipients:** Who should receive notifications? Just HR or multiple people?

2. **Admin access:** Just one admin account, or do you need multiple users with different roles?

3. **Data retention:** How long should submissions be kept? Auto-archive after X days?

4. **Resend account:** Do you already have a Resend account, or should we use Cloudflare's new Email Service (in beta)?
