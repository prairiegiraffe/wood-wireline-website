# Cloudflare Setup Guide

This guide walks through setting up the Cloudflare resources needed for the forms CMS.

## Prerequisites

- Cloudflare account
- Wrangler CLI installed (`npm install -g wrangler`)
- AWS account with SES configured (for email notifications)

## Step 1: Login to Wrangler

```bash
wrangler login
```

## Step 2: Create D1 Database

```bash
# Create the database
wrangler d1 create submissions-db

# Note the database_id from the output, then update wrangler.toml with it
```

Update `wrangler.toml` with the database ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "submissions-db"
database_id = "YOUR_ACTUAL_DATABASE_ID"  # <-- Replace this
```

## Step 3: Run Database Migrations

```bash
# Apply the schema locally first (for testing)
wrangler d1 execute submissions-db --local --file=./db/schema.sql

# Then apply to production
wrangler d1 execute submissions-db --file=./db/schema.sql
```

## Step 4: Create R2 Bucket

```bash
# Create the bucket
wrangler r2 bucket create submissions-files
```

The bucket name in `wrangler.toml` should match:

```toml
[[r2_buckets]]
binding = "STORAGE"
bucket_name = "submissions-files"
```

## Step 5: Create Initial Admin User

Run this SQL to create your first admin user:

```bash
wrangler d1 execute submissions-db --command="INSERT INTO admin_users (email, password_hash, name, role, tenant_id, is_active) VALUES ('admin@woodwireline.com', 'TEMP_HASH', 'Admin User', 'admin', 'default', 1);"
```

Then use the password hashing script (create one or hash manually):

```javascript
// Run this in Node.js to generate a password hash
const crypto = require('crypto');

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const keyLength = 64;
  const iterations = 100000;

  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, keyLength, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${iterations}:${salt.toString('hex')}:${derivedKey.toString('hex')}`);
    });
  });
}

hashPassword('your-secure-password').then(console.log);
```

Update the admin user with the proper hash:

```bash
wrangler d1 execute submissions-db --command="UPDATE admin_users SET password_hash = 'YOUR_HASH_HERE' WHERE email = 'admin@woodwireline.com';"
```

## Step 6: Set Environment Variables

In your Cloudflare Pages dashboard (or via `wrangler pages secret`):

### Required Variables

| Variable     | Description                                  | Example                               |
| ------------ | -------------------------------------------- | ------------------------------------- |
| `JWT_SECRET` | Random 32+ character string for signing JWTs | Generate with: `openssl rand -hex 32` |
| `TENANT_ID`  | Identifier for this tenant                   | `wood-wireline`                       |
| `SITE_URL`   | Full URL of the site                         | `https://woodwireline.com`            |

### AWS SES Variables (for email notifications)

| Variable                | Description                                            |
| ----------------------- | ------------------------------------------------------ |
| `AWS_ACCESS_KEY_ID`     | AWS access key with SES permissions                    |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key                                         |
| `AWS_REGION`            | AWS region where SES is configured (e.g., `us-east-1`) |

### Optional Variables

| Variable              | Description                                             | Default |
| --------------------- | ------------------------------------------------------- | ------- |
| `NOTIFICATION_EMAILS` | Comma-separated list of emails to notify on submissions | None    |

Set secrets via CLI:

```bash
wrangler pages secret put JWT_SECRET
wrangler pages secret put AWS_ACCESS_KEY_ID
wrangler pages secret put AWS_SECRET_ACCESS_KEY
# ... etc
```

## Step 7: Deploy

```bash
npm run build
wrangler pages deploy dist
```

Or connect your GitHub repository to Cloudflare Pages for automatic deployments.

## Step 8: Verify Setup

1. Visit `/admin/login` and log in with your admin credentials
2. Submit a test form on the main site
3. Check that it appears in the admin dashboard
4. Verify email notifications are sent (check SES logs if not)

## Troubleshooting

### "Invalid binding `DB`" error

Make sure your `wrangler.toml` has the correct database_id and that you've created the D1 database.

### "Invalid binding `STORAGE`" error

Make sure you've created the R2 bucket with the exact name in `wrangler.toml`.

### "Invalid binding `SESSION`" warning

The Cloudflare adapter auto-enables sessions with KV. You can ignore this warning or add:

```toml
[[kv_namespaces]]
binding = "SESSION"
id = "YOUR_KV_NAMESPACE_ID"
```

### Email notifications not sending

1. Verify AWS credentials are set correctly
2. Check that SES is out of sandbox mode (or recipient is verified)
3. Check Cloudflare Workers logs for errors

### Forms not submitting

1. Check browser console for errors
2. Verify API routes are working by testing directly
3. Check Cloudflare Workers logs

## Multi-Tenant Setup

For agency/multi-tenant setup:

1. Create additional tenants:

```sql
INSERT INTO tenants (id, name, notification_emails, from_email)
VALUES ('client-abc', 'Client ABC', '["client@example.com"]', 'noreply@client-abc.com');
```

2. Create admin users for each tenant:

```sql
INSERT INTO admin_users (email, password_hash, name, role, tenant_id, is_active)
VALUES ('admin@client-abc.com', 'HASH', 'Client Admin', 'admin', 'client-abc', 1);
```

3. Agency users see all submissions (is_agency_copy = 1), while tenant admins only see their own.

## Database Schema

The full schema is in `db/schema.sql`. Key tables:

- `submissions` - Form submissions (dual-copy: client + agency)
- `admin_users` - Admin dashboard users
- `sessions` - Login sessions
- `tenants` - Multi-tenant configuration
- `email_log` - Email notification audit log
