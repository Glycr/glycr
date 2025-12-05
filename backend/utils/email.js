// ============================================
// FILE: utils/email.js
// ============================================
const transporter = require('../config/email');

const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@glycr.com',
      to,
      subject,
      html
    });
    console.log('Email sent to:', to);
    return true;
  } catch (error) {
    console.error('Email error:', error);
    return false;
  }
};

module.exports = { sendEmail };
