// Application Form API Endpoint
// POST /api/apply - Handle job application submissions with resume upload

import type { APIRoute } from 'astro';
import type { Submission } from '~/lib/types';
import { sendApplicationNotification } from '~/lib/email';

export const prerender = false;

// Max file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed file types
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = locals.runtime.env;
    const { DB, STORAGE } = env;

    // Parse multipart form data
    const formData = await request.formData();

    // Extract form fields
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    const dob = formData.get('dob') as string;
    const location = formData.get('location') as string;
    const experience = formData.get('experience') as string;
    const cdl = formData.get('cdl') as string;
    const pageUrl = formData.get('page_url') as string;
    const resumeFile = formData.get('resume') as File | null;

    // Validate required fields
    if (!name || !email || !phone || !dob || !location || !experience || !cdl) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'All required fields must be filled out',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid email address',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Process resume file if provided
    let resumeKey: string | null = null;
    let resumeFilename: string | null = null;
    let resumeSize: number | null = null;

    if (resumeFile && resumeFile.size > 0) {
      // Validate file size
      if (resumeFile.size > MAX_FILE_SIZE) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Resume file is too large. Maximum size is 5MB.',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Validate file type
      if (!ALLOWED_TYPES.includes(resumeFile.type)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Invalid file type. Please upload a PDF, DOC, or DOCX file.',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Generate unique filename
      const timestamp = Date.now();
      const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const ext = resumeFile.name.split('.').pop()?.toLowerCase() || 'pdf';
      const tenantIdForPath = env.TENANT_ID || 'default';
      resumeKey = `${tenantIdForPath}/resumes/${timestamp}-${safeName}.${ext}`;
      resumeFilename = resumeFile.name;
      resumeSize = resumeFile.size;

      // Upload to R2
      try {
        await STORAGE.put(resumeKey, resumeFile.stream(), {
          httpMetadata: {
            contentType: resumeFile.type,
          },
          customMetadata: {
            originalName: resumeFile.name,
            uploadedBy: email,
            applicantName: name,
          },
        });
      } catch (uploadError) {
        console.error('R2 upload error:', uploadError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to upload resume. Please try again.',
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Get tenant ID and request metadata
    const tenantId = env.TENANT_ID || 'default';
    const ipAddress = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For');
    const userAgent = request.headers.get('User-Agent');

    // Insert CLIENT copy of submission
    const clientResult = await DB.prepare(
      `INSERT INTO submissions (
        tenant_id, is_agency_copy, form_type, name, email, phone, dob,
        location, experience, cdl, resume_key, resume_filename, resume_size,
        source, page_url, ip_address, user_agent
      ) VALUES (?, 0, 'application', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        tenantId,
        name,
        email,
        phone,
        dob,
        location,
        experience,
        cdl,
        resumeKey,
        resumeFilename,
        resumeSize,
        'Website Application Form',
        pageUrl || null,
        ipAddress,
        userAgent
      )
      .run();

    const clientSubmissionId = clientResult.meta.last_row_id;

    // Insert AGENCY copy of submission (immutable)
    await DB.prepare(
      `INSERT INTO submissions (
        tenant_id, is_agency_copy, form_type, name, email, phone, dob,
        location, experience, cdl, resume_key, resume_filename, resume_size,
        source, page_url, ip_address, user_agent
      ) VALUES (?, 1, 'application', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        tenantId,
        name,
        email,
        phone,
        dob,
        location,
        experience,
        cdl,
        resumeKey,
        resumeFilename,
        resumeSize,
        'Website Application Form',
        pageUrl || null,
        ipAddress,
        userAgent
      )
      .run();

    // Get tenant info for email notification
    const tenant = await DB.prepare(`SELECT * FROM tenants WHERE id = ?`).bind(tenantId).first();

    // Get users who should receive notifications for applications
    // notify_forms can be: 'application', 'all' for application notifications
    const usersToNotify = await DB.prepare(`
      SELECT email FROM admin_users
      WHERE is_active = 1
        AND (notify_forms = 'application' OR notify_forms = 'all')
        AND (tenant_id = ? OR tenant_id IS NULL OR role = 'agency')
    `).bind(tenantId).all();

    const notificationEmails: string[] = (usersToNotify.results || []).map((u: any) => u.email);

    // Send notification email (don't block response)
    if (notificationEmails.length > 0) {
      const fromEmail = (tenant?.from_email as string) || `noreply@${env.SITE_URL?.replace(/^https?:\/\//, '') || 'example.com'}`;
      const tenantName = (tenant?.name as string) || 'Website';

      const submission: Partial<Submission> = {
        id: clientSubmissionId as number,
        name,
        email,
        phone,
        dob,
        location,
        experience,
        cdl,
        resume_key: resumeKey,
        resume_filename: resumeFilename,
        resume_size: resumeSize,
        created_at: new Date().toISOString(),
      };

      // Send email asynchronously (don't wait for it)
      sendApplicationNotification(env, submission, tenantName, fromEmail, notificationEmails)
        .then((result) => {
          if (!result.success) {
            console.error('Email notification failed:', result.error);
          }
        })
        .catch((err) => {
          console.error('Email notification error:', err);
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: { id: clientSubmissionId },
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Application form error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'An error occurred while processing your application',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
