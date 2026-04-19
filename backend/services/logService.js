const Log = require('../models/Log');

class LogService {
  async addLog(type, message, meta = {}, adminId = null) {
    const log = new Log({ type, message, meta, adminId });
    await log.save();
    return log;
  }

  async getLogs({ type, search, sort = 'desc', limit = 500, page = 1 } = {}) {
    let query = {};
    if (type && type !== 'all') query.type = type;
    if (search) {
      query.$or = [
        { message: { $regex: search, $options: 'i' } },
        { 'meta': { $regex: search, $options: 'i' } },
      ];
    }

    const sortOrder = sort === 'asc' ? 1 : -1;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      Log.find(query)
        .sort({ timestamp: sortOrder })
        .skip(skip)
        .limit(limit)
        .populate('adminId', 'name email'),
      Log.countDocuments(query),
    ]);

    return { logs, total, page, limit };
  }

  async clearLogs() {
    await Log.deleteMany({});
    return true;
  }
}

module.exports = new LogService();
