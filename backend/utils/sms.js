// ============================================
// FILE: utils/sms.js
// ============================================
const sendSMS = async (phone, message) => {
  try {
    // Integrate with SMS provider (Twilio, Africa's Talking, etc.)
    console.log(`SMS to ${phone}: ${message}`);

    // Example Twilio integration:
    /*
    const client = require('twilio')(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    await client.messages.create({
      body: message,
      to: phone,
      from: process.env.TWILIO_PHONE
    });
    */

    return true;
  } catch (error) {
    console.error('SMS error:', error);
    return false;
  }
};

module.exports = { sendSMS };
