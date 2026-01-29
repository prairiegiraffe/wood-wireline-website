// Admin User Management API
// PATCH /api/admin/users/[id] - Update user (agency only)
// DELETE /api/admin/users/[id] - Delete/deactivate user (agency only)

import type { APIRoute } from 'astro';
import { getTokenFromRequest, verifyToken, validateSession, hashPassword } from '~/lib/auth';
import type { JWTPayload } from '~/lib/types';

export const prerender = false;

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  try {
    const env = locals.runtime.env;
    const { DB } = env;
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ success: false, error: 'User ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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

    // Admin, agency, and superadmin users can update users (viewers cannot)
    if (payload.role === 'viewer') {
      return new Response(JSON.stringify({ success: false, error: 'Access denied' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get existing user
    const existingUser = await DB.prepare('SELECT * FROM admin_users WHERE id = ?').bind(id).first<{ role: string }>();
    if (!existingUser) {
      return new Response(JSON.stringify({ success: false, error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Non-superadmin users cannot edit superadmin users
    if (payload.role !== 'superadmin' && existingUser.role === 'superadmin') {
      return new Response(JSON.stringify({ success: false, error: 'Access denied' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Admin users cannot edit agency users
    if (payload.role === 'admin' && existingUser.role === 'agency') {
      return new Response(JSON.stringify({ success: false, error: 'Access denied' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body = (await request.json()) as {
      name?: string;
      role?: string;
      tenant_id?: string;
      notify_forms?: string;
      is_active?: boolean;
      password?: string;
    };

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name);
    }

    if (body.role !== undefined) {
      // Validate role based on user's role:
      // - superadmin can assign: superadmin, agency, admin, viewer
      // - agency can assign: agency, admin, viewer
      // - admin can only assign: admin, viewer
      let allowedRoles: string[] = [];
      if (payload.role === 'superadmin') {
        allowedRoles = ['superadmin', 'agency', 'admin', 'viewer'];
      } else if (payload.role === 'agency') {
        allowedRoles = ['agency', 'admin', 'viewer'];
      } else if (payload.role === 'admin') {
        allowedRoles = ['admin', 'viewer'];
      }

      if (!allowedRoles.includes(body.role)) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid role or insufficient permissions' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      updates.push('role = ?');
      values.push(body.role);

      // If changing to agency or superadmin, clear tenant_id
      if (body.role === 'agency' || body.role === 'superadmin') {
        updates.push('tenant_id = NULL');
      }
    }

    if (body.tenant_id !== undefined && body.role !== 'agency') {
      updates.push('tenant_id = ?');
      values.push(body.tenant_id);
    }

    if (body.notify_forms !== undefined) {
      const validNotify = ['none', 'contact', 'application', 'all'];
      if (validNotify.includes(body.notify_forms)) {
        updates.push('notify_forms = ?');
        values.push(body.notify_forms);
      }
    }

    if (body.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(body.is_active ? 1 : 0);
    }

    if (body.password) {
      const passwordHash = await hashPassword(body.password);
      updates.push('password_hash = ?');
      values.push(passwordHash);
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'No updates provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    values.push(id);

    await DB.prepare(`UPDATE admin_users SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    // Get updated user
    const updatedUser = await DB.prepare(
      `
      SELECT id, email, name, role, tenant_id, is_active, created_at, last_login
      FROM admin_users WHERE id = ?
    `
    )
      .bind(id)
      .first();

    return new Response(JSON.stringify({ success: true, data: { user: updatedUser } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Update user error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to update user' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  try {
    const env = locals.runtime.env;
    const { DB } = env;
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ success: false, error: 'User ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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

    // Admin, agency, and superadmin users can delete users (viewers cannot)
    if (payload.role === 'viewer') {
      return new Response(JSON.stringify({ success: false, error: 'Access denied' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Prevent self-deletion
    if (payload.sub === id) {
      return new Response(JSON.stringify({ success: false, error: 'Cannot delete your own account' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get user to check if superadmin
    const userToDelete = await DB.prepare('SELECT role FROM admin_users WHERE id = ?')
      .bind(id)
      .first<{ role: string }>();
    if (!userToDelete) {
      return new Response(JSON.stringify({ success: false, error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Non-superadmin users cannot delete superadmin users
    if (payload.role !== 'superadmin' && userToDelete.role === 'superadmin') {
      return new Response(JSON.stringify({ success: false, error: 'Access denied' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Admin users cannot delete agency users
    if (payload.role === 'admin' && userToDelete.role === 'agency') {
      return new Response(JSON.stringify({ success: false, error: 'Access denied' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Delete user's sessions first
    await DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run();

    // Delete user
    await DB.prepare('DELETE FROM admin_users WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to delete user' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
