const logService = require('../services/logService');
const { AppError } = require('../utils/appError');

exports.getLogs = async (req, res, next) => {
  try {
    if (!req.user?.isAdmin) {
      throw new AppError('Forbidden', 403);
    }
    const { type, search, sort, limit, page } = req.query;

    const parsedLimit = Number(limit);
    const parsedPage = Number(page);

    const result = await logService.getLogs({
      type,
      search,
      sort,
      limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 500,
      page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.clearLogs = async (req, res, next) => {
  try {
    if (!req.user?.isAdmin) {
      throw new AppError('Forbidden', 403);
    }
    await logService.clearLogs(req.user.id, req.user.email);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
