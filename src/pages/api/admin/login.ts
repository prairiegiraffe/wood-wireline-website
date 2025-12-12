// Admin Login API Endpoint
// POST /api/admin/login - Authenticate admin users

import type { APIRoute } from 'astro';
import {
  getUserByEmail,
  verifyPassword,
  generateToken,
  generateSessionId,
  createSession,
  createAuthCookie,
  updateLastLogin,
} from '~/lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = locals.runtime.env;
    const { DB } = env;

    // Debug: Check if bindings exist
    if (!DB) {
      console.error('Login error: DB binding is missing');
      return new Response(JSON.stringify({ success: false, error: 'Database not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!env.JWT_SECRET) {
      console.error('Login error: JWT_SECRET is missing');
      return new Response(JSON.stringify({ success: false, error: 'JWT secret not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body = (await request.json()) as { email?: string; password?: string };
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Email and password are required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Find user by email
    const user = await getUserByEmail(DB, email);
    if (!user) {
      // Use generic error to prevent email enumeration
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid email or password',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid email or password',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate session
    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Store session in database
    await createSession(DB, user.id, sessionId, expiresAt);

    // Generate JWT token
    const token = await generateToken(user, env.JWT_SECRET, sessionId);

    // Update last login time
    await updateLastLogin(DB, user.id);

    // Set auth cookie
    const cookie = createAuthCookie(token);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        },
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
    console.error('Login error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: `Login failed: ${errorMessage}`,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
