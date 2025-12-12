// Test Email API Endpoint
// POST /api/admin/test-email - Send a test email to a user (superadmin only)

import type { APIRoute } from 'astro';
import { getTokenFromRequest, verifyToken, validateSession } from '~/lib/auth';
import { sendTestEmail } from '~/lib/email';
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

    // Only superadmin can send test emails
    if (payload.role !== 'superadmin') {
      return new Response(JSON.stringify({ success: false, error: 'Only superadmins can send test emails' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check for required AWS credentials
    if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'AWS SES credentials not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body = (await request.json()) as { userId?: number };
    const { userId } = body;

    if (!userId) {
      return new Response(JSON.stringify({ success: false, error: 'User ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get the target user
    const user = await DB.prepare('SELECT id, email, name FROM admin_users WHERE id = ?')
      .bind(userId)
      .first<{ id: number; email: string; name: string }>();

    if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Send test email
    const fromEmail = env.FROM_EMAIL || 'noreply@woodwireline.com';
    const tenantName = 'Wood Wireline';

    const result = await sendTestEmail(env, user.email, user.name, fromEmail, tenantName);

    if (result.success) {
      return new Response(
        JSON.stringify({
          success: true,
          message: `Test email sent to ${user.email}`,
          messageId: result.messageId,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error || 'Failed to send email',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Test email error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send test email',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
