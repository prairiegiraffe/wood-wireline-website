// Change Password API
// POST /api/admin/change-password - Change own password (all users)

import type { APIRoute } from 'astro';
import { getTokenFromRequest, verifyToken, validateSession, verifyPassword, hashPassword } from '~/lib/auth';
import type { JWTPayload } from '~/lib/types';

export const prerender = false;

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

    // Parse request body
    const body = (await request.json()) as {
      current_password?: string;
      new_password?: string;
    };

    const { current_password, new_password } = body;

    // Validate required fields
    if (!current_password || !new_password) {
      return new Response(JSON.stringify({ success: false, error: 'Current password and new password are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate new password length
    if (new_password.length < 8) {
      return new Response(JSON.stringify({ success: false, error: 'New password must be at least 8 characters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get user's current password hash
    const user = await DB.prepare('SELECT password_hash FROM admin_users WHERE id = ?')
      .bind(payload.sub)
      .first<{ password_hash: string }>();

    if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify current password
    const isValidPassword = await verifyPassword(current_password, user.password_hash);
    if (!isValidPassword) {
      return new Response(JSON.stringify({ success: false, error: 'Current password is incorrect' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(new_password);

    // Update password
    await DB.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').bind(newPasswordHash, payload.sub).run();

    return new Response(JSON.stringify({ success: true, message: 'Password changed successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Change password error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to change password' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
