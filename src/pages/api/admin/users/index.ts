// Admin Users API
// GET /api/admin/users - List all users (agency only)
// POST /api/admin/users - Create new user (agency only)

import type { APIRoute } from 'astro';
import { getTokenFromRequest, verifyToken, validateSession, hashPassword } from '~/lib/auth';
import type { JWTPayload } from '~/lib/types';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const env = locals.runtime.env;
    const { DB } = env;

    // Authenticate
    const token = getTokenFromRequest(request);
    if (!token) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let payload: JWTPayload;
    try {
      payload = await verifyToken(token, env.JWT_SECRET);
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const sessionValid = await validateSession(DB, payload.jti);
    if (!sessionValid) {
      return new Response(JSON.stringify({ success: false, error: 'Session expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Only agency and superadmin users can manage users
    if (payload.role !== 'agency' && payload.role !== 'superadmin') {
      return new Response(JSON.stringify({ success: false, error: 'Access denied' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get all users - agency users don't see superadmins
    const usersQuery =
      payload.role === 'superadmin'
        ? `SELECT id, email, name, role, tenant_id, is_active, created_at, last_login
         FROM admin_users
         ORDER BY created_at DESC`
        : `SELECT id, email, name, role, tenant_id, is_active, created_at, last_login
         FROM admin_users
         WHERE role != 'superadmin'
         ORDER BY created_at DESC`;
    const result = await DB.prepare(usersQuery).all();

    return new Response(
      JSON.stringify({
        success: true,
        data: { users: result.results || [] },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Get users error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to get users' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = locals.runtime.env;
    const { DB } = env;

    // Authenticate
    const token = getTokenFromRequest(request);
    if (!token) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let payload: JWTPayload;
    try {
      payload = await verifyToken(token, env.JWT_SECRET);
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const sessionValid = await validateSession(DB, payload.jti);
    if (!sessionValid) {
      return new Response(JSON.stringify({ success: false, error: 'Session expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Only agency and superadmin users can create users
    if (payload.role !== 'agency' && payload.role !== 'superadmin') {
      return new Response(JSON.stringify({ success: false, error: 'Access denied' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      name?: string;
      role?: string;
      tenant_id?: string;
      notify_forms?: string;
    };

    const { email, password, name, role, tenant_id, notify_forms } = body;

    // Validate required fields
    if (!email || !password || !name || !role) {
      return new Response(JSON.stringify({ success: false, error: 'Email, password, name, and role are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate role - only superadmin can create superadmin users
    const allowedRoles =
      payload.role === 'superadmin' ? ['superadmin', 'agency', 'admin', 'viewer'] : ['agency', 'admin', 'viewer'];
    if (!allowedRoles.includes(role)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid role' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // For admin/viewer roles, tenant_id is required
    if ((role === 'admin' || role === 'viewer') && !tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tenant ID is required for admin and viewer roles' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if email already exists
    const existing = await DB.prepare('SELECT id FROM admin_users WHERE email = ?').bind(email).first();
    if (existing) {
      return new Response(JSON.stringify({ success: false, error: 'Email already exists' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Validate notify_forms
    const validNotify = ['none', 'contact', 'application', 'all'];
    const notifyValue = validNotify.includes(notify_forms || '') ? notify_forms : 'none';

    // Insert user - agency and superadmin don't have tenant_id
    const effectiveTenantId = role === 'agency' || role === 'superadmin' ? null : tenant_id;
    const result = await DB.prepare(
      `
      INSERT INTO admin_users (email, password_hash, name, role, tenant_id, notify_forms, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `
    )
      .bind(email, passwordHash, name, role, effectiveTenantId, notifyValue)
      .run();

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          user: {
            id: result.meta.last_row_id,
            email,
            name,
            role,
            tenant_id: effectiveTenantId,
            notify_forms: notifyValue,
          },
        },
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Create user error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to create user' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
