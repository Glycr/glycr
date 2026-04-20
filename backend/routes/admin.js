const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const waitlistController = require('../controllers/waitlistController');
const settingsController = require('../controllers/settingsController');
const ticketController = require('../controllers/ticketController');
const logController = require('../controllers/logController');
const auth = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');


router.use(auth);

// Dashboard stats
router.get('/admin/stats', adminController.getStats);

// Users
router.get('/admin/users', adminController.getAllUsers);
router.patch('/admin/users/:id/suspend', adminController.suspendUser);
router.delete('/admin/users/:id', adminController.deleteUser);
router.post('/admin/users', auth, roleMiddleware(['admin']), adminController.createUser);
router.put('/admin/users/:id', auth, roleMiddleware(['admin', 'moderator']), adminController.updateUser);

// Base path: /waitlists
router.get('/admin/waitlists', auth, roleMiddleware(['admin', 'moderator']), waitlistController.getWaitlist);
router.post('/admin/waitlists/notify', auth, roleMiddleware(['admin', 'moderator']), waitlistController.notifyWaitlist);

// All admin routes require authentication and at least moderator role
router.use(auth);
router.use(roleMiddleware(['moderator', 'admin']));

// Only admin can change user roles
router.patch('/admin/users/:id/role', roleMiddleware(['admin']), adminController.changeUserRole);

// Events
router.get('/admin/events', adminController.getAllEvents);
router.patch('/admin/events/:id/flag', adminController.flagEvent);
router.delete('/admin/events/:id', adminController.deleteEvent);
router.patch('/admin/events/:id/publish', auth, roleMiddleware(['admin', 'moderator']), adminController.togglePublish);

// Tickets
router.get('/admin/tickets', adminController.getAllTickets);
router.patch('/admin/tickets/:id/validate', auth, roleMiddleware(['admin', 'moderator']), ticketController.validateTicket);
router.patch('/admin/tickets/:id/cancel', auth, roleMiddleware(['admin', 'moderator']), ticketController.cancelTicket);


// Payouts
router.get('/admin/payouts', adminController.getAllPayouts);
router.patch('/admin/payouts/:id/approve', adminController.approvePayout);
router.patch('/admin/payouts/:id/reject', adminController.rejectPayout);

// Logs
router.get('/admin/logs', logController.getLogs);
router.post('/admin/logs', logController.addLog);
router.delete('/admin/logs', auth, roleMiddleware(['admin']), logController.clearLogs);

// Settings
router.get('/admin/settings', auth, roleMiddleware(['admin', 'moderator']), settingsController.getSettings);
router.put('/admin/settings', auth, roleMiddleware(['admin']), settingsController.updateSettings);


module.exports = router;
