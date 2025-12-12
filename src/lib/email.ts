// AWS SES Email Service
// Sends notification emails when new submissions arrive

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import type { CloudflareEnv, Submission } from './types';

interface EmailOptions {
  to: string[];
  from: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Create an SES client with credentials from environment
 */
function createSESClient(env: CloudflareEnv): SESClient {
  return new SESClient({
    region: env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

/**
 * Send an email using AWS SES
 */
export async function sendEmail(
  env: CloudflareEnv,
  options: EmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const client = createSESClient(env);

    const command = new SendEmailCommand({
      Source: options.from,
      Destination: {
        ToAddresses: options.to,
      },
      Message: {
        Subject: {
          Data: options.subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: options.html,
            Charset: 'UTF-8',
          },
          ...(options.text && {
            Text: {
              Data: options.text,
              Charset: 'UTF-8',
            },
          }),
        },
      },
    });

    const response = await client.send(command);

    return {
      success: true,
      messageId: response.MessageId,
    };
  } catch (error) {
    console.error('SES Email Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send notification for new contact form submission
 */
export async function sendContactNotification(
  env: CloudflareEnv,
  submission: Partial<Submission>,
  tenantName: string,
  fromEmail: string,
  toEmails: string[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const siteUrl = env.SITE_URL || 'https://woodwireline.com';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1a1a1a; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .field { margin-bottom: 15px; }
        .label { font-weight: bold; color: #666; }
        .value { margin-top: 5px; }
        .button { display: inline-block; background: #b43232; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New Contact Form Submission</h1>
        </div>
        <div class="content">
          <div class="field">
            <div class="label">Name</div>
            <div class="value">${escapeHtml(submission.name || '')}</div>
          </div>
          <div class="field">
            <div class="label">Email</div>
            <div class="value"><a href="mailto:${escapeHtml(submission.email || '')}">${escapeHtml(submission.email || '')}</a></div>
          </div>
          ${
            submission.phone
              ? `
          <div class="field">
            <div class="label">Phone</div>
            <div class="value"><a href="tel:${escapeHtml(submission.phone)}">${escapeHtml(submission.phone)}</a></div>
          </div>
          `
              : ''
          }
          <div class="field">
            <div class="label">Message</div>
            <div class="value">${escapeHtml(submission.message || '').replace(/\n/g, '<br>')}</div>
          </div>

          <a href="${siteUrl}/admin/submissions/${submission.id}" class="button">View in Admin Dashboard</a>
        </div>
        <div class="footer">
          <p>This notification was sent from ${tenantName}'s website.</p>
          <p>Submitted on ${new Date(submission.created_at || '').toLocaleString()}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
New Contact Form Submission

Name: ${submission.name}
Email: ${submission.email}
${submission.phone ? `Phone: ${submission.phone}` : ''}

Message:
${submission.message}

View in admin: ${siteUrl}/admin/submissions/${submission.id}
  `.trim();

  return sendEmail(env, {
    to: toEmails,
    from: fromEmail,
    subject: `New Contact from ${submission.name} - ${tenantName}`,
    html,
    text,
  });
}

/**
 * Send notification for new job application
 */
export async function sendApplicationNotification(
  env: CloudflareEnv,
  submission: Partial<Submission>,
  tenantName: string,
  fromEmail: string,
  toEmails: string[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const siteUrl = env.SITE_URL || 'https://woodwireline.com';

  const locationMap: Record<string, string> = {
    gillette: 'Gillette, WY (HQ)',
    casper: 'Casper, WY',
    dickinson: 'Dickinson, ND',
    williston: 'Williston, ND',
    any: 'Any Location',
  };

  const experienceMap: Record<string, string> = {
    none: 'No Experience',
    '1-3': '1-3 Years',
    '3-5': '3-5 Years',
    '5+': '5+ Years',
  };

  const cdlMap: Record<string, string> = {
    'class-a': 'Class A CDL',
    'class-b': 'Class B CDL',
    standard: "Standard Driver's License",
    none: "No Driver's License",
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1a1a1a; color: white; padding: 20px; text-align: center; }
        .badge { display: inline-block; background: #b43232; color: white; padding: 4px 12px; border-radius: 20px; font-size: 14px; margin-top: 10px; }
        .content { padding: 20px; background: #f9f9f9; }
        .field { margin-bottom: 15px; }
        .label { font-weight: bold; color: #666; }
        .value { margin-top: 5px; }
        .button { display: inline-block; background: #b43232; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        .button-secondary { background: #666; margin-left: 10px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New Job Application</h1>
          <span class="badge">ACTION REQUIRED</span>
        </div>
        <div class="content">
          <div class="grid">
            <div class="field">
              <div class="label">Applicant Name</div>
              <div class="value">${escapeHtml(submission.name || '')}</div>
            </div>
            <div class="field">
              <div class="label">Email</div>
              <div class="value"><a href="mailto:${escapeHtml(submission.email || '')}">${escapeHtml(submission.email || '')}</a></div>
            </div>
            <div class="field">
              <div class="label">Phone</div>
              <div class="value"><a href="tel:${escapeHtml(submission.phone || '')}">${escapeHtml(submission.phone || '')}</a></div>
            </div>
            <div class="field">
              <div class="label">Date of Birth</div>
              <div class="value">${escapeHtml(submission.dob || '')}</div>
            </div>
            <div class="field">
              <div class="label">Preferred Location</div>
              <div class="value">${locationMap[submission.location || ''] || submission.location}</div>
            </div>
            <div class="field">
              <div class="label">Experience</div>
              <div class="value">${experienceMap[submission.experience || ''] || submission.experience}</div>
            </div>
            <div class="field">
              <div class="label">License Type</div>
              <div class="value">${cdlMap[submission.cdl || ''] || submission.cdl}</div>
            </div>
            <div class="field">
              <div class="label">Resume</div>
              <div class="value">${submission.resume_filename ? `📎 ${escapeHtml(submission.resume_filename)}` : 'Not provided'}</div>
            </div>
          </div>

          <a href="${siteUrl}/admin/submissions/${submission.id}" class="button">Review Application</a>
        </div>
        <div class="footer">
          <p>This application was submitted through ${tenantName}'s website.</p>
          <p>Received on ${new Date(submission.created_at || '').toLocaleString()}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
New Job Application - ACTION REQUIRED

Applicant: ${submission.name}
Email: ${submission.email}
Phone: ${submission.phone}
DOB: ${submission.dob}
Preferred Location: ${locationMap[submission.location || ''] || submission.location}
Experience: ${experienceMap[submission.experience || ''] || submission.experience}
License: ${cdlMap[submission.cdl || ''] || submission.cdl}
Resume: ${submission.resume_filename || 'Not provided'}

Review application: ${siteUrl}/admin/submissions/${submission.id}
  `.trim();

  return sendEmail(env, {
    to: toEmails,
    from: fromEmail,
    subject: `🆕 Job Application: ${submission.name} - ${locationMap[submission.location || ''] || 'Unknown Location'}`,
    html,
    text,
  });
}

/**
 * Send a test email to verify email configuration is working
 */
export async function sendTestEmail(
  env: CloudflareEnv,
  toEmail: string,
  userName: string,
  fromEmail: string,
  tenantName: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const siteUrl = env.SITE_URL || 'https://woodwireline.com';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1a1a1a; color: white; padding: 20px; text-align: center; }
        .badge { display: inline-block; background: #22c55e; color: white; padding: 4px 12px; border-radius: 20px; font-size: 14px; margin-top: 10px; }
        .content { padding: 20px; background: #f9f9f9; }
        .success-box { background: #dcfce7; border: 1px solid #22c55e; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
        .success-box h3 { color: #15803d; margin: 0 0 8px 0; }
        .success-box p { color: #166534; margin: 0; }
        .info-box { background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 16px; }
        .info-box h4 { color: #0369a1; margin: 0 0 8px 0; }
        .info-box ul { color: #0c4a6e; margin: 0; padding-left: 20px; }
        .button { display: inline-block; background: #b43232; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🧪 Test Email</h1>
          <span class="badge">Configuration Verified</span>
        </div>
        <div class="content">
          <div class="success-box">
            <h3>✅ Email System Working!</h3>
            <p>Hi ${escapeHtml(userName)}, this test email confirms that your email notifications are properly configured.</p>
          </div>

          <div class="info-box">
            <h4>What this means:</h4>
            <ul>
              <li>AWS SES credentials are valid</li>
              <li>Email sending is operational</li>
              <li>Your email address (${escapeHtml(toEmail)}) is receiving messages</li>
            </ul>
          </div>

          <p style="margin-top: 20px; color: #666;">
            You'll receive email notifications based on your notification preferences when new form submissions arrive.
          </p>

          <a href="${siteUrl}/admin" class="button">Go to Admin Dashboard</a>
        </div>
        <div class="footer">
          <p>This test email was sent from ${tenantName}'s admin dashboard.</p>
          <p>Sent on ${new Date().toLocaleString()}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Test Email - Configuration Verified

Hi ${userName},

This test email confirms that your email notifications are properly configured.

What this means:
- AWS SES credentials are valid
- Email sending is operational
- Your email address (${toEmail}) is receiving messages

You'll receive email notifications based on your notification preferences when new form submissions arrive.

Visit the admin dashboard: ${siteUrl}/admin

This test email was sent from ${tenantName}'s admin dashboard.
Sent on ${new Date().toLocaleString()}
  `.trim();

  return sendEmail(env, {
    to: [toEmail],
    from: fromEmail,
    subject: `🧪 Test Email - ${tenantName} Admin`,
    html,
    text,
  });
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
