// Resume Download/View API Endpoint
// GET /api/admin/resume/[...key] - Download or view resume from R2 storage
// Add ?view=1 to view inline instead of downloading

import type { APIRoute } from 'astro';
import { getTokenFromRequest, verifyToken, validateSession } from '~/lib/auth';
import type { JWTPayload } from '~/lib/types';

export const prerender = false;

export const GET: APIRoute = async ({ params, request, locals, url }) => {
  try {
    const env = locals.runtime.env;
    const { DB, STORAGE } = env;
    const { key } = params;

    if (!key) {
      return new Response('Resume key required', { status: 400 });
    }

    // Authenticate
    const token = getTokenFromRequest(request);
    if (!token) {
      return new Response('Unauthorized', { status: 401 });
    }

    let payload: JWTPayload;
    try {
      payload = await verifyToken(token, env.JWT_SECRET);
    } catch {
      return new Response('Invalid token', { status: 401 });
    }

    const sessionValid = await validateSession(DB, payload.jti);
    if (!sessionValid) {
      return new Response('Session expired', { status: 401 });
    }

    // The key from [...key] route comes as the full path
    const decodedKey = decodeURIComponent(key);
    console.log('Resume request - raw key:', key, 'decoded:', decodedKey);

    // For non-agency/non-superadmin users, verify they have access to this tenant's files
    if (payload.role !== 'agency' && payload.role !== 'superadmin') {
      const tenantId = payload.tenant_id || env.TENANT_ID || 'default';
      // Resume keys can be in format: {tenant_id}/resumes/... or resumes/{tenant_id}/...
      if (!decodedKey.startsWith(`${tenantId}/`) && !decodedKey.includes(`/${tenantId}/`)) {
        return new Response('Access denied', { status: 403 });
      }
    }

    // Debug: Check if STORAGE binding exists
    if (!STORAGE) {
      console.error('Resume error: STORAGE binding is missing');
      return new Response('Storage not configured', { status: 500 });
    }

    // Get file from R2
    const object = await STORAGE.get(decodedKey);

    if (!object) {
      console.error('Resume not found in R2 - key:', decodedKey);
      return new Response(`Resume not found: ${decodedKey}`, { status: 404 });
    }

    // Get original filename from custom metadata or derive from key
    const originalName = object.customMetadata?.originalName || decodedKey.split('/').pop() || 'resume';

    // Determine content type based on file extension if not set
    let contentType = object.httpMetadata?.contentType || 'application/octet-stream';
    if (contentType === 'application/octet-stream') {
      if (decodedKey.endsWith('.pdf')) {
        contentType = 'application/pdf';
      } else if (decodedKey.endsWith('.docx')) {
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (decodedKey.endsWith('.doc')) {
        contentType = 'application/msword';
      }
    }

    // Check if inline viewing is requested
    const viewInline = url.searchParams.get('view') === '1';
    const disposition = viewInline ? 'inline' : `attachment; filename="${originalName}"`;

    // Get the body as ArrayBuffer to ensure proper binary transfer
    const arrayBuffer = await object.arrayBuffer();

    // Return file with headers that allow iframe embedding
    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': disposition,
        'Content-Length': object.size.toString(),
        'Cache-Control': 'private, max-age=3600',
        'X-Frame-Options': 'SAMEORIGIN',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Resume download error:', error);
    return new Response('Failed to download resume', { status: 500 });
  }
};
