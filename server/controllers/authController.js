const userService = require('../services/userService');
const logService = require('../services/logService');

const ctx = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

exports.register = async (req, res, next) => {
  try {
    const user = await userService.register(req.body);
    // user already has virtuals? ensure service returns virtuals
    logService.audit(user.email, 'register', user.email, {
      type: 'auth', adminId: user._id, role: user.role, ...ctx(req),
    });
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await userService.login(email, password);
    logService.audit(result.user.email, 'login', result.user.email, {
      type: 'auth', adminId: result.user._id, role: result.user.role, ...ctx(req),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    const user = await userService.getProfile(req.user.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const user = await userService.updateProfile(req.user.id, req.body);
    // Field names only, never values
    const submittedFields = Object.keys(req.body || {}).filter((k) => k !== 'password');
    logService.audit(req.user.email, 'update_profile', req.user.email, {
      type: 'user', adminId: req.user.id, submittedFields, ...ctx(req),
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const { token, user } = await userService.generatePasswordResetToken(email);
    // Send email (stub)
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:63342/Glycr/frontend/index.html'}?reset_token=${token}`;
    console.log(`📧 Reset link for ${user.email}: ${resetLink}`);
    // In production, send email via Nodemailer
    logService.audit(user.email, 'password_reset_requested', user.email, {
      type: 'auth', adminId: user._id, ...ctx(req),
    });
    res.json({ message: 'Password reset email sent' });
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    const user = await userService.resetPassword(token, newPassword);
    logService.audit(user.email, 'reset_password', user.email, {
      type: 'auth', adminId: user._id, ...ctx(req),
    });
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await userService.changePassword(req.user.id, currentPassword, newPassword);
    logService.audit(req.user.email, 'change_password', req.user.email, {
      type: 'auth', adminId: req.user.id, ...ctx(req),
    });
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
};
