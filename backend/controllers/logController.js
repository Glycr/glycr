const logService = require('../services/logService');

exports.addLog = async (req, res, next) => {
  try {
    const { type, message, meta } = req.body;
    if (!type || !message) {
      return res.status(400).json({ error: 'Type and message are required' });
    }
    const log = await logService.addLog(type, message, meta || {}, req.user.id);
    res.status(201).json(log);
  } catch (err) {
    next(err);
  }
};

exports.getLogs = async (req, res, next) => {
  try {
    const { type, search, sort, limit, page } = req.query;
    const result = await logService.getLogs({
      type,
      search,
      sort,
      limit: parseInt(limit) || 500,
      page: parseInt(page) || 1,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.clearLogs = async (req, res, next) => {
  try {
    await logService.clearLogs();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
