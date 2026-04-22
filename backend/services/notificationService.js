const { Resend } = require('resend');
const twilio = require('twilio');

let resend = null;
let twilioClient = null;

// Initialize Resend if API key exists
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
} else {
  console.warn('⚠️ RESEND_API_KEY not set – email sending will fail');
}

// Initialize Twilio if credentials exist
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
} else {
  console.warn('⚠️ Twilio credentials missing – SMS sending will fail');
}

/**
 * Send an email using Resend
 * @param {string} to - recipient email
 * @param {string} subject - email subject
 * @param {string} html - HTML content
 * @param {string} text - plain text alternative (optional)
 */
async function sendEmail(to, subject, html, text = null) {
  if (!resend) {
    throw new Error('Resend not configured. Set RESEND_API_KEY.');
  }

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Glycr <noreply@glycr.com>',
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // simple plain text fallback
    });
    if (error) throw new Error(error.message);
    console.log(`✅ Email sent to ${to}, id: ${data?.id}`);
    return data;
  } catch (err) {
    console.error(`❌ Failed to send email to ${to}:`, err.message);
    throw err; // re‑throw so caller can handle
  }
}

/**
 * Send an SMS using Twilio
 * @param {string} to - phone number in E.164 format (+233XXXXXXXXX)
 * @param {string} body - SMS message
 */
async function sendSMS(to, body) {
  if (!twilioClient) {
    throw new Error('Twilio not configured. Check TWILIO_ACCOUNT_SID / AUTH_TOKEN.');
  }

  try {
    const message = await twilioClient.messages.create({
      body,
      to,
      from: process.env.TWILIO_PHONE_NUMBER,
    });
    console.log(`✅ SMS sent to ${to}, sid: ${message.sid}`);
    return message;
  } catch (err) {
    console.error(`❌ Failed to send SMS to ${to}:`, err.message);
    throw err;
  }
}

module.exports = { sendEmail, sendSMS };
