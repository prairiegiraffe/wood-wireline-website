// Contact Form API Endpoint
// POST /api/contact - Handle contact form submissions

import type { APIRoute } from 'astro';
import type { ContactFormData, Submission } from '~/lib/types';
import { sendContactNotification } from '~/lib/email';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = locals.runtime.env;
    const { DB } = env;

    // Parse JSON body
    const data: ContactFormData = await request.json();

    // Validate required fields
    if (!data.name || !data.email || !data.message) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Name, email, and message are required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
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

    // Get tenant ID from environment
    const tenantId = env.TENANT_ID || 'default';

    // Get request metadata
    const ipAddress = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For');
    const userAgent = request.headers.get('User-Agent');

    // Insert CLIENT copy of submission
    const clientResult = await DB.prepare(
      `INSERT INTO submissions (
        tenant_id, is_agency_copy, form_type, name, email, phone, message,
        source, page_url, ip_address, user_agent
      ) VALUES (?, 0, 'contact', ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        tenantId,
        data.name,
        data.email,
        data.phone || null,
        data.message,
        'Website Contact Form',
        data.page_url || null,
        ipAddress,
        userAgent
      )
      .run();

    const clientSubmissionId = clientResult.meta.last_row_id;

    // Insert AGENCY copy of submission (immutable)
    await DB.prepare(
      `INSERT INTO submissions (
        tenant_id, is_agency_copy, form_type, name, email, phone, message,
        source, page_url, ip_address, user_agent
      ) VALUES (?, 1, 'contact', ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        tenantId,
        data.name,
        data.email,
        data.phone || null,
        data.message,
        'Website Contact Form',
        data.page_url || null,
        ipAddress,
        userAgent
      )
      .run();

    // Get tenant info for email notification
    const tenant = await DB.prepare(`SELECT * FROM tenants WHERE id = ?`).bind(tenantId).first();

    // Get users who should receive notifications for contact forms
    // notify_forms can be: 'contact', 'all' for contact form notifications
    const usersToNotify = await DB.prepare(
      `
      SELECT email FROM admin_users
      WHERE is_active = 1
        AND (notify_forms = 'contact' OR notify_forms = 'all')
        AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '' OR role = 'agency' OR role = 'superadmin')
    `
    )
      .bind(tenantId)
      .all();

    const notificationEmails: string[] = (usersToNotify.results || []).map((u: { email: string }) => u.email);

    // Send notification email (don't block response)
    console.log('Notification emails query returned:', notificationEmails.length, 'recipients:', notificationEmails);
    if (notificationEmails.length > 0) {
      const fromEmail =
        (tenant?.from_email as string) || `noreply@${env.SITE_URL?.replace(/^https?:\/\//, '') || 'example.com'}`;
      const tenantName = (tenant?.name as string) || 'Website';

      console.log('Sending contact notification from:', fromEmail, 'to:', notificationEmails);

      const submission: Partial<Submission> = {
        id: clientSubmissionId as number,
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        message: data.message,
        created_at: new Date().toISOString(),
      };

      // Send email synchronously for debugging
      const emailResult = await sendContactNotification(env, submission, tenantName, fromEmail, notificationEmails);
      console.log('Email notification result:', emailResult);

      return new Response(
        JSON.stringify({
          success: true,
          data: { id: clientSubmissionId },
          debug: {
            emailSent: emailResult.success,
            emailError: emailResult.error,
            messageId: emailResult.messageId,
            fromEmail,
            toEmails: notificationEmails,
          },
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } else {
      console.log('No notification emails to send - no recipients matched query');
      return new Response(
        JSON.stringify({
          success: true,
          data: { id: clientSubmissionId },
          debug: {
            emailSent: false,
            reason: 'No recipients matched notification query',
          },
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error('Contact form error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'An error occurred while processing your submission',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
