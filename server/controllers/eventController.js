const eventService = require('../services/eventService');
const logService = require('../services/logService');
const Event = require('../models/Event'); // only used to read the title before an event is deleted
const multer = require('multer');
const path = require('path');
const config = require('../config');

const ctx = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Helper to parse ticketTypes if it's a string
const parseTicketTypes = (req) => {
  if (req.body.ticketTypes && typeof req.body.ticketTypes === 'string') {
    try {
      req.body.ticketTypes = JSON.parse(req.body.ticketTypes);
    } catch (err) {
      throw new Error('Invalid ticketTypes JSON');
    }
  }
};

exports.createEvent = [
  upload.single('image'),
  async (req, res, next) => {
    try {
      parseTicketTypes(req);
      const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
      const event = await eventService.createEvent(req.user.id, req.body, imageUrl);
      logService.audit(req.user.email, 'create_event', event?.title || req.body?.title, {
        type: 'event', adminId: req.user.id, eventId: String(event?._id || event?.id || ''), ...ctx(req),
      });
      res.status(201).json(event);
    } catch (err) {
      next(err);
    }
  }
];

exports.getEvents = async (req, res, next) => {
  try {
    const filters = req.query;
    const events = await eventService.getEvents(filters);
    res.json(events);
  } catch (err) {
    next(err);
  }
};

exports.getEvent = async (req, res, next) => {
  try {
    const event = await eventService.getEventById(req.params.id);
    res.json(event);
  } catch (err) {
    next(err);
  }
};

exports.updateEvent = [
  upload.single('image'),
  async (req, res, next) => {
    try {
      parseTicketTypes(req);
      const imageUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
      const event = await eventService.updateEvent(req.params.id, req.user.id, req.body, imageUrl);
      // Field names only, never values
      logService.audit(req.user.email, 'update_event', event?.title || req.params.id, {
        type: 'event', adminId: req.user.id, eventId: req.params.id,
        submittedFields: Object.keys(req.body || {}), imageChanged: !!req.file, ...ctx(req),
      });
      res.json(event);
    } catch (err) {
      next(err);
    }
  }
];



exports.deleteEvent = async (req, res, next) => {
  try {
    const before = await Event.findById(req.params.id).select('title').lean();
    await eventService.deleteEvent(req.params.id, req.user.id);
    logService.audit(req.user.email, 'delete_event', before?.title || req.params.id, {
      type: 'danger', adminId: req.user.id, eventId: req.params.id, ...ctx(req),
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

exports.togglePublish = async (req, res, next) => {
  try {
    const event = await eventService.togglePublish(req.params.id, req.user.id);
    // Only log when we know the saved state, so the label can't be inverted
    if (typeof event?.isPublished === 'boolean') {
      logService.audit(req.user.email, event.isPublished ? 'publish_event' : 'unpublish_event', event.title || req.params.id, {
        type: 'event', adminId: req.user.id, eventId: req.params.id, ...ctx(req),
      });
    }
    res.json(event);
  } catch (err) {
    next(err);
  }
};

exports.cancelEvent = async (req, res, next) => {
  try {
    const event = await eventService.cancelEvent(req.params.id, req.user.id);
    logService.audit(req.user.email, 'cancel_event', event?.title || req.params.id, {
      type: 'danger', adminId: req.user.id, eventId: req.params.id, ...ctx(req),
    });
    res.json(event);
  } catch (err) {
    next(err);
  }
};

exports.flagEvent = async (req, res, next) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  try {
    const event = await eventService.flagEvent(req.params.id);
    logService.audit(req.user.email, 'flag_event', event?.title || req.params.id, {
      type: 'event', adminId: req.user.id, eventId: req.params.id, ...ctx(req),
    });
    res.json(event);
  } catch (err) {
    next(err);
  }
};

exports.unflagEvent = async (req, res, next) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  try {
    const event = await eventService.unflagEvent(req.params.id);
    logService.audit(req.user.email, 'unflag_event', event?.title || req.params.id, {
      type: 'event', adminId: req.user.id, eventId: req.params.id, ...ctx(req),
    });
    res.json(event);
  } catch (err) {
    next(err);
  }
};
