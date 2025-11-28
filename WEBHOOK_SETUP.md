# Make.com Webhook Integration Setup

## Overview
Both the Contact Form and Application Form now send submissions to Make.com webhooks, which can then route the data to Google Sheets for both the client and your white-label partner.

## Setup Instructions

### 1. Get Your Make.com Webhook URL

In Make.com:
1. Create a new scenario
2. Add a "Custom Webhook" trigger module
3. Click "Add" to create a new webhook
4. Copy the webhook URL

**Note:** You only need ONE webhook URL. Both forms will send to the same webhook and be routed based on the `formType` field.

### 2. Configure Environment Variables

Create a `.env` file in the project root with your webhook URL:

```bash
# Make.com Webhook URL (handles both contact and application forms)
PUBLIC_MAKE_WEBHOOK_URL=https://hook.us2.make.com/your-webhook-url-here
```

**Important:** Never commit the `.env` file to git (it's already in `.gitignore`)

### 3. Add to Cloudflare Pages Environment Variables

Since this is a static site, the environment variables need to be added to Cloudflare Pages:

1. Go to your Cloudflare Pages dashboard
2. Select your project
3. Go to Settings → Environment variables
4. Add the following variable for Production:
   - `PUBLIC_MAKE_WEBHOOK_URL` = your webhook URL
5. Click "Save"
6. Redeploy your site

## Data Structure

### Contact Form Submission

```json
{
  "formType": "contact",
  "name": "John Smith",
  "email": "john@example.com",
  "phone": "307-555-1234",
  "company": "ABC Company",
  "message": "I need wireline services...",
  "timestamp": "2025-01-28T10:30:00.000Z",
  "source": "Wood Wireline Contact Form",
  "page_url": "https://woodwireline.com/contact"
}
```

### Application Form Submission

```json
{
  "formType": "careers",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "307-555-5678",
  "dob": "1990-01-15",
  "location": "gillette",
  "experience": "5+",
  "cdl": "class-a",
  "resume": {
    "filename": "resume.pdf",
    "content": "base64-encoded-file-content",
    "type": "application/pdf",
    "size": 245678
  },
  "timestamp": "2025-01-28T10:35:00.000Z",
  "source": "Wood Wireline Application Form",
  "page_url": "https://woodwireline.com/apply"
}
```

**Key Field:** Both submissions include `formType` which is either `"contact"` or `"careers"` for routing in Make.com.

## Make.com Scenario Setup

### Recommended Flow (Single Webhook with Router)

1. **Custom Webhook** - Receives all form submissions
2. **Router** - Routes based on `formType` field

   **Route 1: Contact Form** (`formType` = "contact")
   - Filter: `formType` equals `contact`
   - Google Sheets - Add Row (Client Contact Sheet)
   - Google Sheets - Add Row (Partner Contact Sheet)
   - Optional: Email notification to sales team

   **Route 2: Application Form** (`formType` = "careers")
   - Filter: `formType` equals `careers`
   - Google Drive - Upload File (from base64 resume)
   - Google Sheets - Add Row (Client Careers Sheet) with resume link
   - Google Sheets - Add Row (Partner Careers Sheet) with resume link
   - Optional: Email notification to HR

### Example Make.com Router Setup

```
Webhook → Router
           ├─ [formType = "contact"] → Contact Flow
           └─ [formType = "careers"] → Careers Flow
```

### Decoding Resume in Make.com

The resume file is sent as base64. In Make.com:
1. Use "Google Drive - Upload a File" module
2. Map the data:
   - File Name: `{{resume.filename}}`
   - Data: Use the built-in base64 function: `{{base64(resume.content)}}`
   - Or direct: `{{resume.content}}` (Make.com auto-detects base64)

## Testing

### Local Testing
1. Set up your `.env` file with webhook URLs
2. Run `npm run dev`
3. Fill out and submit the contact or application form
4. Check Make.com scenario history to see the data

### Production Testing
1. Deploy to Cloudflare Pages with environment variables set
2. Submit a test form on the live site
3. Verify data appears in your Google Sheets

## Troubleshooting

**Forms not submitting:**
- Check browser console for errors
- Verify webhook URLs are correct
- Check Make.com scenario is active

**Environment variables not working:**
- Make sure variables start with `PUBLIC_` prefix
- Verify they're set in Cloudflare Pages
- Redeploy after adding variables

**Resume not uploading:**
- Check file size (max 5MB enforced by form)
- Verify Make.com can handle the base64 data
- Check Google Drive permissions in Make.com

## Support

For issues with:
- Form functionality: Check browser console
- Make.com integration: Check scenario execution history
- Environment variables: Verify Cloudflare Pages settings
