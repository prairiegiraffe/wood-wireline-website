// Single Submission API Endpoint
// GET /api/admin/submission/[id] - Get submission details
// PATCH /api/admin/submission/[id] - Update submission status/notes
// DELETE /api/admin/submission/[id] - Soft delete submission

import type { APIRoute } from 'astro';
import { getTokenFromRequest, verifyToken, validateSession, canModify } from '~/lib/auth';
import type { Submission, JWTPayload } from '~/lib/types';

export const prerender = false;

// GET - Fetch single submission
export const GET: APIRoute = async ({ params, request, locals }) => {
  try {
    const env = locals.runtime.env;
    const { DB } = env;
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ success: false, error: 'Submission ID required' }), {
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

    // Build query based on role
    let query: string;
    let bindParams: (string | number)[];

    if (payload.role === 'agency') {
      // Agency sees agency copies
      query = `SELECT * FROM submissions WHERE id = ? AND is_agency_copy = 1`;
      bindParams = [parseInt(id)];
    } else {
      // Clients see their own copies
      query = `SELECT * FROM submissions WHERE id = ? AND is_agency_copy = 0 AND tenant_id = ? AND deleted_at IS NULL`;
      bindParams = [parseInt(id), payload.tenant_id || env.TENANT_ID || 'default'];
    }

    const submission = await DB.prepare(query)
      .bind(...bindParams)
      .first<Submission>();

    if (!submission) {
      return new Response(JSON.stringify({ success: false, error: 'Submission not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: submission,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Get submission error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to fetch submission' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// PATCH - Update submission
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  try {
    const env = locals.runtime.env;
    const { DB } = env;
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ success: false, error: 'Submission ID required' }), {
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

    // Check write permission
    if (!canModify(payload)) {
      return new Response(JSON.stringify({ success: false, error: 'Permission denied' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse update data
    const updates = (await request.json()) as Record<string, string | null | undefined>;
    const allowedFields = ['status', 'admin_notes', 'reviewed_at'];
    const updateFields: string[] = [];
    const updateValues: (string | null)[] = [];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updates[field]);
      }
    }

    if (updateFields.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'No valid fields to update' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Add updated_at
    updateFields.push('updated_at = datetime("now")');

    // Build and execute update query (only client copies can be updated)
    const tenantId = payload.tenant_id || env.TENANT_ID || 'default';
    const query = `
      UPDATE submissions
      SET ${updateFields.join(', ')}
      WHERE id = ? AND is_agency_copy = 0 AND tenant_id = ? AND deleted_at IS NULL
    `;

    const result = await DB.prepare(query)
      .bind(...updateValues, parseInt(id), tenantId)
      .run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Submission not found or no changes made' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: { updated: true },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Update submission error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to update submission' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// DELETE - Soft delete submission
export const DELETE: APIRoute = async ({ params, request, locals }) => {
  try {
    const env = locals.runtime.env;
    const { DB } = env;
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ success: false, error: 'Submission ID required' }), {
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

    // Check write permission
    if (!canModify(payload)) {
      return new Response(JSON.stringify({ success: false, error: 'Permission denied' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Soft delete (only affects client's copy, agency copy remains intact)
    const tenantId = payload.tenant_id || env.TENANT_ID || 'default';
    const result = await DB.prepare(
      `UPDATE submissions
       SET deleted_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ? AND is_agency_copy = 0 AND tenant_id = ? AND deleted_at IS NULL`
    )
      .bind(parseInt(id), tenantId)
      .run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Submission not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: { deleted: true },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Delete submission error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to delete submission' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
