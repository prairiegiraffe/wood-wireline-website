// Update Notification Preferences API Endpoint
// POST /api/admin/update-notifications - Update current user's notification settings

import type { APIRoute } from 'astro';
import { getTokenFromRequest, verifyToken, validateSession } from '~/lib/auth';
import type { JWTPayload } from '~/lib/types';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = locals.runtime.env;
    const { DB } = env;

    if (!DB) {
      return new Response(JSON.stringify({ success: false, error: 'Database not configured' }), {
        status: 500,
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

    // Parse request body
    const body = (await request.json()) as { notify_forms?: string };
    const { notify_forms } = body;

    // Validate notify_forms value
    const validValues = ['none', 'contact', 'application', 'all'];
    if (!notify_forms || !validValues.includes(notify_forms)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid notification preference' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update user's notification preference
    await DB.prepare('UPDATE admin_users SET notify_forms = ? WHERE id = ?').bind(notify_forms, payload.sub).run();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notification preferences updated',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Update notifications error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to update preferences' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
