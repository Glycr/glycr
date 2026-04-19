const nodemailer = require('nodemailer');
const twilio = require('twilio');

class NotificationService {
  constructor() {
    // Email transporter (lazy init)
    this.transporter = null;
    // Twilio client (lazy init)
    this.twilioClient = null;
  }

  // Get or create email transporter
  getTransporter() {
    if (!this.transporter && process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT == '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
    return this.transporter;
  }

  // Get or create Twilio client
  getTwilioClient() {
    if (!this.twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }
    return this.twilioClient;
  }

  /**
   * Send an email
   * @param {string} to - recipient email
   * @param {string} subject - email subject
   * @param {string} html - HTML content
   * @param {string} text - plain text alternative (optional)
   */
  async sendEmail({ to, subject, html, text }) {
    const transporter = this.getTransporter();
    if (!transporter) {
      console.log(`📧 Email to ${to}: ${subject} - ${html?.substring(0, 100)}...`);
      return;
    }

    try {
      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || `"Glycr" <${process.env.SMTP_USER}>`,
        to,
        subject,
        text: text || html.replace(/<[^>]*>/g, ''),
        html,
      });
      console.log(`✅ Email sent to ${to}, messageId: ${info.messageId}`);
      return info;
    } catch (err) {
      console.error(`❌ Failed to send email to ${to}:`, err.message);
      throw err; // re-throw if you want calling code to handle
    }
  }

  /**
   * Send an SMS
   * @param {string} to - phone number (E.164 format, e.g., +233XXXXXXXXX)
   * @param {string} body - SMS message
   */
  async sendSMS({ to, body }) {
    const client = this.getTwilioClient();
    if (!client) {
      console.log(`📱 SMS to ${to}: ${body}`);
      return;
    }

    try {
      const message = await client.messages.create({
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
}

module.exports = new NotificationService();
