const mongoose = require('mongoose');
const Log = require('../models/Log');
const logger = require('../config/logger');

const LEVEL_MAP = { danger: 'error', warning: 'warn' }; // everything else -> info
const MAX_LIMIT = 500;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

class LogService {
  // Persists to MongoDB and mirrors to winston. Throws on DB failure.
  async addLog(type, message, meta = {}, adminId = null) {
    const validAdmin = mongoose.isValidObjectId(adminId) ? adminId : undefined;
    const log = await Log.create({ type, message, meta, adminId: validAdmin });
    logger.log(LEVEL_MAP[type] || 'info', message, { type, ...meta });
    return log;
  }

  // Audit helper: never breaks the request if logging fails.
  async audit(actor, action, target, extra = {}) {
    const { type = 'event', ip, userAgent, ...rest } = extra;
    const message = `${actor || 'system'} -> ${action}${target ? ` on ${target}` : ''}`;
    try {
      return await this.addLog(
        type,
        message,
        { actor: actor || 'system', action, target: target || '', ip, userAgent, ...rest },
        actor
      );
    } catch (err) {
      logger.error('Audit log failed', { err: err.message, message });
      return null;
    }
  }

  async getLogs({ type, search, sort = 'desc', limit = 100, page = 1 } = {}) {
    limit = Math.min(Math.max(limit, 1), MAX_LIMIT);
    page = Math.max(page, 1);

    const query = {};
    if (type && type !== 'all') query.type = type;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      query.$or = [
        { message: rx },
        { 'meta.actor': rx },
        { 'meta.action': rx },
        { 'meta.target': rx },
      ];
    }

    const [logs, total] = await Promise.all([
      Log.find(query)
        .sort({ timestamp: sort === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('adminId', 'name email')
        .lean({ virtuals: true }),
      Log.countDocuments(query),
    ]);

    return { logs, total, page, limit };
  }

  async clearLogs(adminId) {
    const { deletedCount } = await Log.deleteMany({});
    // Leave a trace that the wipe happened
    await this.audit(adminId, 'clear_logs', 'logs', { type: 'warning', deletedCount });
    return true;
  }
}

module.exports = new LogService();
