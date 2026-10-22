const messageService = require('../services/messageService');
const logService = require('../services/logService');
const { AppError } = require('../utils/appError');

const ctx = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

exports.getAllMessages = async (req, res, next) => {
  try {
    if (!req.user?.isAdmin) {
      throw new AppError('Forbidden', 403);
    }
    const result = await messageService.getAllMessages({
      type: req.query.type,
      audience: req.query.audience,
      limit: req.query.limit,
      skip: req.query.skip,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.createDirectMessage = async (req, res, next) => {
  try {
    if (!req.user?.isAdmin) {
      throw new AppError('Forbidden', 403);
    }
    const { recipientId, subject, body, channel } = req.body || {};
    const sentBy = req.user.email;
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
    if (!req.user?.isAdmin) {
      throw new AppError('Forbidden', 403);
    }
    const { audience, subject, body, channel } = req.body || {};
    const sentBy = req.user.email;
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
    if (!req.user?.isAdmin) {
      throw new AppError('Forbidden', 403);
    }
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
