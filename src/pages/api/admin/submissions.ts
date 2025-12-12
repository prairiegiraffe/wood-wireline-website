// Admin Submissions API Endpoint
// GET /api/admin/submissions - List submissions with filtering

import type { APIRoute } from 'astro';
import { getTokenFromRequest, verifyToken, validateSession } from '~/lib/auth';
import type { JWTPayload } from '~/lib/types';
import type { Submission } from '~/lib/types';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals, url }) => {
  try {
    const env = locals.runtime.env;
    const { DB } = env;

    // Authenticate request
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

    // Validate session exists
    const sessionValid = await validateSession(DB, payload.jti);
    if (!sessionValid) {
      return new Response(JSON.stringify({ success: false, error: 'Session expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse query parameters
    const formType = url.searchParams.get('form_type'); // 'contact' | 'application'
    const status = url.searchParams.get('status'); // 'new' | 'reviewed' | etc
    const search = url.searchParams.get('search'); // Search in name/email
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    // Build query based on user role
    let whereClause = 'WHERE deleted_at IS NULL';
    const params: (string | number)[] = [];

    // Agency sees all (is_agency_copy = 1), clients see their own (is_agency_copy = 0)
    if (payload.role === 'agency') {
      whereClause += ' AND is_agency_copy = 1';
    } else {
      whereClause += ' AND is_agency_copy = 0 AND tenant_id = ?';
      params.push(payload.tenant_id || env.TENANT_ID || 'default');
    }

    // Apply filters
    if (formType) {
      whereClause += ' AND form_type = ?';
      params.push(formType);
    }

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      whereClause += ' AND (name LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM submissions ${whereClause}`;
    const countResult = await DB.prepare(countQuery)
      .bind(...params)
      .first<{ count: number }>();
    const total = countResult?.count || 0;

    // Get submissions
    const query = `
      SELECT id, tenant_id, form_type, status, name, email, phone, location, experience,
             resume_filename, created_at, updated_at, reviewed_at
      FROM submissions
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const result = await DB.prepare(query)
      .bind(...params, limit, offset)
      .all<Partial<Submission>>();

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          submissions: result.results || [],
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Submissions list error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch submissions',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
