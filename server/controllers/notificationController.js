const { sendEmail, sendSMS } = require('../services/notificationService');
const logService = require('../services/logService');
const { AppError } = require('../utils/appError');

const ctx = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

exports.sendEmail = async (req, res, next) => {
  try {
    if (!req.user?.isAdmin) {
      throw new AppError('Forbidden', 403);
    }
    const { to, subject, html, text } = req.body || {};

    // Service validates `to`, `subject`, and one-of(html, text). Let it throw
    // AppError-style 400s instead of duplicating the checks here.
    const data = await sendEmail(to, subject, html, text);

    logService.audit(req.user.email, 'send_email', String(to), {
      type: 'system', adminId: req.user.id,
      to, subject: String(subject || '').slice(0, 200),
      resendId: data?.id || null, ...ctx(req),
    });

    res.json({ message: 'Email sent', id: data?.id });
  } catch (err) {
    next(err);
  }
};

exports.sendSMS = async (req, res, next) => {
  try {
    if (!req.user?.isAdmin) {
      throw new AppError('Forbidden', 403);
    }
    const { to, body } = req.body || {};

    const message = await sendSMS(to, body);

    logService.audit(req.user.email, 'send_sms', String(to), {
      type: 'system', adminId: req.user.id,
      to, twilioSid: message?.sid || null, ...ctx(req),
    });

    res.json({ message: 'SMS sent', sid: message?.sid });
  } catch (err) {
    next(err);
  }
};
