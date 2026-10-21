const logService = require('../services/logService');

// Types the panel may write. auth/payout/danger are server-only, so staff can't forge them.
const CLIENT_TYPES = ['system', 'event', 'user'];

exports.addLog = async (req, res, next) => {
  try {
    const { type, message, meta, persist } = req.body;

    if (typeof type !== 'string' || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Type and message are required' });
    }
    if (!CLIENT_TYPES.includes(type)) {
      return res.status(400).json({ error: `Type must be one of: ${CLIENT_TYPES.join(', ')}` });
    }

    const safeMeta = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};

    // Read-only events (views) go to winston only
    if (persist === false || /^viewed\b/i.test(message)) {
      logService.trace(type, message, { ...safeMeta, adminId: req.user.id });
      return res.status(204).send();
    }

    // The server decides who the actor is; the client can't spoof it
    const actor = req.user.email || req.user.name || String(req.user.id);
    const log = await logService.addLog(type, message, safeMeta, req.user.id, { actor, ip: req.ip });
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
    await logService.clearLogs(req.user.id, req.user.email || req.user.name);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};


