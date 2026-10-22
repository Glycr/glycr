const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validate, registerSchema, loginSchema } = require('../middleware/validation');
const { authLimiter, resetLimiter, registerLimiter } = require('../middleware/rateLimit');
const auth = require('../middleware/auth');
const { loginSlowDown } = require('../middleware/slowDown');

// ── Register ──
// registerLimiter: 3 registrations/hour per IP — blocks bulk signup regardless
// of email (authLimiter alone keys on email+IP and skips successes, so a bot
// creating unique emails bypasses it).
// authLimiter: 5 failed registrations/15min per (email, IP) — catches repeat
// attempts against the same email (duplicate, weak password).
router.post(
  '/auth/register',
  validate(registerSchema),
  registerLimiter,
  authLimiter,
  authController.register
);

// ── Login ──
// validate first (rejects malformed bodies before they consume limiter budget),
// then slowDown (adds latency after 2 failures), then authLimiter (hard block
// after 5 failures). Successful logins decrement both, so typos don't punish
// legitimate users.
router.post(
  '/auth/login',
  validate(loginSchema),
  loginSlowDown,
  authLimiter,
  authController.login
);

// ── Authenticated: self profile ──
router.get('/auth/profile', auth, authController.getProfile);
router.put('/auth/profile', auth, authController.updateProfile);

// ── Forgot password ──
// resetLimiter protects the Resend email budget — 3 requests/hour per
// (email, IP). Spamming a target's inbox would burn your Resend quota and
// risk account suspension.
router.post('/auth/forgot-password', resetLimiter, authController.forgotPassword);

// ── Reset password ──
// No rate limiter. Protection comes from the reset token itself:
//   - JWT-signed, 1-hour expiry
//   - Verified against JWT_SECRET → invalid tokens fail at jwt.verify (fast)
//   - Single-use: passwordChangedAt invalidates the token after reset
// A per-IP or per-email limiter here caused more harm (NAT sharing, legit
// users blocked on typos) than it prevented, because the key generator
// couldn't identify the user from a body that has no email field.
router.post('/auth/reset-password', authController.resetPassword);

// ── Change password ──
// authLimiter keys on req.user.email (set by auth middleware), so 5 failures
// per user per 15 min. Successful changes decrement the counter, so a user
// changing password twice in a day isn't blocked.
router.post('/auth/change-password', auth, authLimiter, authController.changePassword);

module.exports = router;
