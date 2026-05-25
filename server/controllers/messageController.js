const messageService = require('../services/messageService');

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
    res.status(201).json(msg);
  } catch (err) {
    next(err);
  }
};

exports.deleteMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    await messageService.deleteMessage(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
