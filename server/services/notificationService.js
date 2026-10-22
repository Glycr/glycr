// services/notificationService.js
const { Resend } = require('resend');
const twilio = require('twilio');
const { logger } = require('../config/logger');

let resend = null;
let twilioClient = null;

if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
} else {
  logger.warn('RESEND_API_KEY not set — email sending will fail');
}

if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
} else {
  logger.warn('Twilio credentials missing — SMS sending will fail');
}

const EMAIL_FROM = process.env.EMAIL_FROM || 'Glycr <noreply@glycr.com>';

// Basic HTML → text conversion (good enough for deliverability fallback)
const htmlToText = (html) =>
  String(html || '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .trim();

/**
 * Send an email via Resend.
 * Throws a plain Error on failure — callers should either await (to know
 * the outcome) or .catch(logger.error) for fire-and-forget delivery.
 */
async function sendEmail(to, subject, html, text = null) {
  if (!resend) {
    throw new Error('Email service not configured (RESEND_API_KEY missing)');
  }
  if (!to || typeof to !== 'string') {
    throw new Error('sendEmail: "to" is required');
  }
  if (!subject || typeof subject !== 'string') {
    throw new Error('sendEmail: "subject" is required');
  }
  if (!html && !text) {
    throw new Error('sendEmail: one of "html" or "text" is required');
  }

  const payload = {
    from: EMAIL_FROM,
    to,
    subject,
    html: html || `<pre>${text}</pre>`,
    text: text || htmlToText(html),
  };

  try {
    const { data, error } = await resend.emails.send(payload);
    if (error) {
      const msg = error.message || error.name || JSON.stringify(error);
      throw new Error(`Resend rejected the email: ${msg}`);
    }
    logger.info('Email sent', { to, id: data?.id });
    return data;
  } catch (err) {
    logger.error('sendEmail failed', { to, subject, err: err.message });
    throw err;
  }
}

/**
 * Send an SMS via Twilio. `to` must be E.164 format: +233XXXXXXXXX.
 */
async function sendSMS(to, body) {
  if (!twilioClient) {
    throw new Error('SMS service not configured (Twilio credentials missing)');
  }
  if (!process.env.TWILIO_PHONE_NUMBER) {
    throw new Error('TWILIO_PHONE_NUMBER is not set');
  }
  if (!to || typeof to !== 'string') {
    throw new Error('sendSMS: "to" is required');
  }
  if (!to.startsWith('+')) {
    throw new Error(`sendSMS: "to" must be E.164 format starting with + (got: ${to})`);
  }
  if (!body || typeof body !== 'string') {
    throw new Error('sendSMS: "body" is required');
  }

  try {
    const message = await twilioClient.messages.create({
      body,
      to,
      from: process.env.TWILIO_PHONE_NUMBER,
    });
    logger.info('SMS sent', { to, sid: message.sid });
    return message;
  } catch (err) {
    logger.error('sendSMS failed', { to, err: err.message });
    throw err;
  }
}

module.exports = { sendEmail, sendSMS };
