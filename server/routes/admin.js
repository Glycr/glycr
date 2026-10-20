const express = require('express');
const router = express.Router();

const adminController = require('../controllers/adminController');
const settingsController = require('../controllers/settingsController');
const ticketController = require('../controllers/ticketController');
const logController = require('../controllers/logController');
const refundController = require('../controllers/refundController');
const serviceRequestController = require('../controllers/serviceRequestController');

const auth = require('../middleware/auth');
const { requireAdmin, requireModeratorOrAdmin } = require('../middleware/rbac');

// Runs once, only for /admin/*: authenticated + moderator or admin.
// Everything below inherits this; add requireAdmin only where stricter.
router.use('/admin', auth, requireModeratorOrAdmin);

// Dashboard
router.get('/admin/stats', adminController.getStats);

// Users
router.get('/admin/users', adminController.getAllUsers);
router.post('/admin/users', requireAdmin, adminController.createUser);
router.put('/admin/users/:id', adminController.updateUser);
router.patch('/admin/users/:id/suspend', adminController.suspendUser);
router.patch('/admin/users/:id/role', requireAdmin, adminController.changeUserRole);
router.delete('/admin/users/:id', requireAdmin, adminController.deleteUser);

// Waitlist
router.get('/admin/waitlists', adminController.getAllWaitlists);
router.post('/admin/waitlist/:id/notify', adminController.notifyWaitlistEntry);
router.post('/admin/waitlist/:id/convert', adminController.convertWaitlistToTicket);
router.delete('/admin/waitlist/:id', adminController.deleteWaitlistEntry);

// Events
router.get('/admin/events', adminController.getAllEvents);
router.patch('/admin/events/:id/flag', adminController.flagEvent);
router.patch('/admin/events/:id/publish', adminController.togglePublish);
router.delete('/admin/events/:id', adminController.deleteEvent);

// Tickets
router.get('/admin/tickets', adminController.getAllTickets);
router.patch('/admin/tickets/:id/validate', ticketController.validateTicket);
router.patch('/admin/tickets/:id/cancel', ticketController.cancelTicket);
router.get('/admin/coupons', requireAdmin, adminController.getAllCoupons);

// Service requests
router.get('/admin/service-requests', requireModeratorOrAdmin, serviceRequestController.getAllRequests);
router.patch('/admin/service-requests/:id/status', serviceRequestController.updateStatus);
router.patch('/admin/service-requests/:id/resolve', serviceRequestController.resolveRequest);
router.patch('/admin/service-requests/:id/in-progress', serviceRequestController.markInProgress);

// Payouts
router.get('/admin/payouts', requireModeratorOrAdmin, adminController.getAllPayouts);
router.patch('/admin/payouts/:id/approve', requireModeratorOrAdmin, adminController.approvePayout);
router.patch('/admin/payouts/:id/reject', requireModeratorOrAdmin, adminController.rejectPayout);

// Logs
router.get('/admin/logs', requireModeratorOrAdmin,logController.getLogs);
router.post('/admin/logs', requireModeratorOrAdmin, logController.addLog);
router.delete('/admin/logs', requireAdmin, logController.clearLogs);

// Settings
router.get('/admin/settings', settingsController.getSettings);
router.put('/admin/settings', requireAdmin, settingsController.updateSettings);

// Refunds
router.get('/admin/refunds/all', requireAdmin, refundController.getAllRefunds);

module.exports = router;
