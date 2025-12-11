// Admin Logout API Endpoint
// POST /api/admin/logout - End admin session

import type { APIRoute } from 'astro';
import { getTokenFromRequest, verifyToken, deleteSession, createLogoutCookie } from '~/lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = locals.runtime.env;
    const { DB } = env;

    // Get token from request
    const token = getTokenFromRequest(request);

    if (token) {
      try {
        // Verify and decode token to get session ID
        const payload = await verifyToken(token, env.JWT_SECRET);

        // Delete session from database
        if (payload.jti) {
          await deleteSession(DB, payload.jti);
        }
      } catch {
        // Token invalid, but that's ok - we're logging out anyway
      }
    }

    // Clear auth cookie
    const cookie = createLogoutCookie();

    return new Response(
      JSON.stringify({
        success: true,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': cookie,
        },
      }
    );
  } catch (error) {
    console.error('Logout error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'An error occurred during logout',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

// Also support GET for simple link-based logout
export const GET: APIRoute = async (context) => {
  const response = await POST(context);

  // If successful, redirect to login page
  if (response.status === 200) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/admin/login',
        'Set-Cookie': createLogoutCookie(),
      },
    });
  }

  return response;
};
