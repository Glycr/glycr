const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');

// ── Self-action: toggle favorite ──
// Uses req.user.id (the caller), not req.params.id. Any authenticated user
// can add/remove their own favorites. The service validates eventId + action.
//
// All admin user-management endpoints live in routes/admin.js under
// /admin/users/* (backed by adminController → adminService, which enforce
// the moderator-vs-admin constraint that userService does not).
//
// The routes previously in this file (GET/PUT/PATCH/DELETE /users/:id) were
// only `auth`-gated. Any customer could:
//   - GET  /users              → enumerate every user (email + phone)
//   - GET  /users/:id          → read any user's profile
//   - PUT  /users/:id          → change another user's email → account takeover
//   - PATCH /users/:id/suspend → suspend any account, including admins
//   - DELETE /users/:id        → cascade-delete any account
// All removed. Use /admin/users/* for admin operations.

router.get('/users/favorites',  auth, userController.getFavorites);
router.post('/users/favorites', auth, userController.toggleFavorite);

module.exports = router;
