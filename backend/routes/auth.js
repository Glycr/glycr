const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validate, registerSchema, loginSchema } = require('../middleware/validation');
const { apiLimiter, authLimiter, resetLimiter } = require('../middleware/rateLimit');
const auth = require('../middleware/auth');

// Base path: /auth
router.post('/auth/register', validate(registerSchema), authLimiter, authController.register);
router.post('/auth/login', validate(loginSchema),authLimiter, authController.login);
router.get('/auth/profile', auth, authController.getProfile);
router.put('/auth/profile', auth, authController.updateProfile);
router.post('/auth/forgot-password', resetLimiter, authController.forgotPassword);
router.post('/auth/reset-password', resetLimiter, authController.resetPassword);
router.post('/auth/change-password', auth, authController.changePassword);

module.exports = router;
