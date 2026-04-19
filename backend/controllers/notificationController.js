const notificationService = require('../services/notificationService');

exports.sendEmail = async (req, res, next) => {
  try {
    const { to, subject, html, text } = req.body;
    if (!to || !subject) {
      return res.status(400).json({ error: 'To and subject are required' });
    }
    const info = await emailService.sendEmail({ to, subject, html, text });
    res.json({ message: 'Email sent', messageId: info.messageId });
  } catch (err) {
    next(err);
  }
};

exports.sendSMS = async (req, res, next) => {
  try {
    const { to, body } = req.body;
    if (!to || !body) {
      return res.status(400).json({ error: 'To and body are required' });
    }
    const message = await smsService.sendSMS({ to, body });
    res.json({ message: 'SMS sent', sid: message.sid });
  } catch (err) {
    next(err);
  }
};
