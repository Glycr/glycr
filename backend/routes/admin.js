
// ============================================
// FILE: routes/adminRoutes.js
// ============================================
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.get('/users', authenticateToken, requireAdmin, adminController.getAllUsers);
router.patch('/users/:id/suspend', authenticateToken, requireAdmin, adminController.suspendUser);
router.delete('/users/:id', authenticateToken, requireAdmin, adminController.deleteUser);

router.get('/events', authenticateToken, requireAdmin, adminController.getAllEvents);
router.patch('/events/:id/flag', authenticateToken, requireAdmin, adminController.flagEvent);

router.get('/payouts', authenticateToken, requireAdmin, adminController.getAllPayouts);
router.patch('/payouts/:id/approve', authenticateToken, requireAdmin, adminController.approvePayout);
router.patch('/payouts/:id/reject', authenticateToken, requireAdmin, adminController.rejectPayout);

router.get('/stats', authenticateToken, requireAdmin, adminController.getStats);

module.exports = router;
