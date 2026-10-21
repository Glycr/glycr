const messageService = require('../services/messageService');
const logService = require('../services/logService');

const ctx = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

exports.getAllMessages = async (req, res, next) => {
  try {
    const result = await messageService.getAllMessages();
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.createDirectMessage = async (req, res, next) => {
  try {
    const { recipientId, subject, body, channel } = req.body;
    const sentBy = req.user.name || req.user.email;
    const msg = await messageService.createDirectMessage(recipientId, subject, body, channel, sentBy);
    // Subject and channel only; the message body is not stored in the audit trail
    logService.audit(req.user.email, 'send_direct_message', String(recipientId), {
      type: 'user', adminId: req.user.id, messageId: String(msg?._id || msg?.id || ''),
      channel, subject: String(subject || '').slice(0, 100), ...ctx(req),
    });
    res.status(201).json(msg);
  } catch (err) {
    next(err);
  }
};

exports.createBroadcast = async (req, res, next) => {
  try {
    const { audience, subject, body, channel } = req.body;
    const sentBy = req.user.name || req.user.email;
    const msg = await messageService.createBroadcast(audience, subject, body, channel, sentBy);
    logService.audit(req.user.email, 'send_broadcast', String(audience), {
      type: 'system', adminId: req.user.id, messageId: String(msg?._id || msg?.id || ''),
      channel, subject: String(subject || '').slice(0, 100), ...ctx(req),
    });
    res.status(201).json(msg);
  } catch (err) {
    next(err);
  }
};

exports.deleteMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    await messageService.deleteMessage(id);
    logService.audit(req.user.email, 'delete_message', String(id), {
      type: 'system', adminId: req.user.id, messageId: id, ...ctx(req),
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
