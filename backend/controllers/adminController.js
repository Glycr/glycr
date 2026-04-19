const adminService = require('../services/adminService');
const Payout = require('../models/Payout');
const Event = require('../models/Event');

exports.getStats = async (req, res, next) => {
  try {
    const stats = await adminService.getStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
};

exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await adminService.getAllUsers();
    res.json(users);
  } catch (err) {
    next(err);
  }
};

exports.createUser = async (req, res, next) => {
  try {
    const user = await adminService.createUser(req.body);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const user = await adminService.updateUser(req.params.id, req.body, req.user.role);
    res.json(user);
  } catch (err) {
    next(err);
  }
};

exports.suspendUser = async (req, res, next) => {
  try {
    const result = await adminService.suspendUser(req.user.id, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    await adminService.deleteUser(req.user.id, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

exports.changeUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const user = await adminService.changeUserRole(req.user.id, req.params.id, role);
    res.json(user);
  } catch (err) {
    next(err);
  }
};


exports.getAllEvents = async (req, res, next) => {
  try {
    const events = await adminService.getAllEvents();
    res.json(events);
  } catch (err) {
    next(err);
  }
};

exports.flagEvent = async (req, res, next) => {
  try {
    const event = await adminService.flagEvent(req.params.id);
    res.json(event);
  } catch (err) {
    next(err);
  }
};

exports.deleteEvent = async (req, res, next) => {
  try {
    await adminService.deleteEvent(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

exports.getAllTickets = async (req, res, next) => {
  try {
    const tickets = await adminService.getAllTickets();
    res.json(tickets);
  } catch (err) {
    next(err);
  }
};

exports.getAllPayouts = async (req, res, next) => {
  try {
    const payouts = await adminService.getAllPayouts();
    res.json(payouts);
  } catch (err) {
    next(err);
  }
};

exports.getAllPayouts = async (req, res, next) => {
  try {
    const payouts = await Payout.find().populate('organizerId', 'name email');
    res.json(payouts);
  } catch (err) {
    next(err);
  }
};

exports.approvePayout = async (req, res, next) => {
  try {
    const payout = await adminService.approvePayout(req.params.id);
    res.json(payout);
  } catch (err) {
    next(err);
  }
};

exports.rejectPayout = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Rejection reason required' });
    const payout = await adminService.rejectPayout(req.params.id, reason);
    res.json(payout);
  } catch (err) {
    next(err);
  }
};


exports.togglePublish = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    event.isPublished = !event.isPublished;
    await event.save();
    res.json(event);
  } catch (err) {
    next(err);
  }
};


