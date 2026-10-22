// services/serviceRequestService.js
const ServiceRequest = require('../models/ServiceRequest');
const User = require('../models/User');
const { sendEmail } = require('./notificationService');
const { AppError } = require('../utils/appError');
const { logger } = require('../config/logger');
const { escapeHtml, sanitizeHeader } = require('../utils/htmlSecurity');

// Must match the enum on ServiceRequest.status in models/ServiceRequest.js
const VALID_STATUSES = ['pending', 'in_progress', 'resolved', 'closed', 'cancelled'];

// Must match the <select id="help-subject"> options in index.html
const VALID_CATEGORIES = [
  'ticket_issue',
  'payment_problem',
  'refund_request',
  'organizer_support',
  'account_issue',
  'bug_report',
  'other',
];

const assertNonEmpty = (value, field) => {
  if (!value || typeof value !== 'string' || !value.trim()) {
    throw new AppError(`${field} is required`, 400);
  }
};

const assertEmail = (email) => {
  assertNonEmpty(email, 'userEmail');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError('userEmail must be a valid email address', 400);
  }
};

const buildRequestId = (count, now) => {
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const position = String(count).padStart(2, '0');
  return `SR-${position}${day}${month}${year}`;
};

class ServiceRequestService {
  // actingUser: { id, email } | null — null for anonymous submissions.
  // The controller passes req.user shape; identity resolution (trusting the
  // JWT email over the body, fetching the display name from the DB) lives here.
  async createRequest(actingUser, body) {
    const { name, email, category, subject, message } = body || {};

    let userId = null;
    let userName;
    let userEmail;

    if (actingUser?.id) {
      userId = actingUser.id;
      // JWT email is authoritative — prevents a logged-in user from spoofing
      // a different email in the form body. Fall back to body only if JWT
      // somehow has no email (should never happen for authenticated users).
      userEmail = actingUser.email || email;
      // JWT does not carry the display name — fetch it. Falls back to the
      // submitted name if the user record is missing (edge case: deleted user
      // whose token is still valid).
      const user = await User.findById(actingUser.id).select('name').lean();
      userName = user?.name || name;
    } else {
      userName = name;
      userEmail = email;
    }

    // ── Validation ──
    assertNonEmpty(userName, 'userName');
    assertEmail(userEmail);
    assertNonEmpty(subject, 'subject');
    assertNonEmpty(message, 'message');
    if (!VALID_CATEGORIES.includes(category)) {
      throw new AppError(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`, 400);
    }
    if (subject.length > 200) {
      throw new AppError('Subject must be at most 200 characters', 400);
    }
    if (message.length > 5000) {
      throw new AppError('Message must be at most 5000 characters', 400);
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const MAX_ATTEMPTS = 5;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const countToday = await ServiceRequest.countDocuments({
        submittedAt: { $gte: startOfDay, $lte: endOfDay },
      });

      const request = new ServiceRequest({
        requestId: buildRequestId(countToday + 1 + attempt, now),
        userId: userId || null,
        userName: userName.trim(),
        userEmail: userEmail.toLowerCase().trim(),
        category,
        subject: subject.trim(),
        message: message.trim(),
        status: 'pending',
      });

      try {
        await request.save();
        return request;
      } catch (err) {
        if (err.code === 11000 && err.keyPattern?.requestId) continue;
        if (err.code === 11000) {
          throw new AppError('A request with these details already exists', 409);
        }
        throw err;
      }
    }

    throw new AppError('Could not allocate a request id, please try again', 503);
  }

  async getAllRequests(filters = {}) {
    const limit = Math.min(Number(filters.limit) || 200, 500);
    const skip  = Number(filters.skip) || 0;

    return ServiceRequest.find()
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  async updateStatus(requestId, status, resolutionNotes = null) {
    if (!requestId) throw new AppError('requestId is required', 400);
    if (!VALID_STATUSES.includes(status)) {
      throw new AppError(`Status must be one of: ${VALID_STATUSES.join(', ')}`, 400);
    }
    if (status === 'resolved') {
      assertNonEmpty(resolutionNotes, 'resolutionNotes');
    }

    const request = await ServiceRequest.findById(requestId);
    if (!request) throw new AppError('Service request not found', 404);

    if (request.status === 'closed' && status !== 'closed') {
      throw new AppError('A closed request cannot be reopened', 409);
    }
    if (request.status === status) {
      throw new AppError(`Request is already in status "${status}"`, 409);
    }

    request.status = status;

    if (status === 'resolved') {
      request.resolvedAt = new Date();
      request.resolutionNotes = resolutionNotes.trim();
    } else {
      request.resolvedAt = null;
      request.resolutionNotes = null;
    }

    await request.save();

    if (status === 'resolved') {
      const subjectSafe = sanitizeHeader(`Your support request has been resolved: ${request.subject}`);
      const html = `
        <p>Your request has been marked as resolved.</p>
        <p><strong>Resolution notes:</strong><br>${escapeHtml(resolutionNotes)}</p>
        <p>If you have further questions, please reply to this email.</p>
      `;
      sendEmail(request.userEmail, subjectSafe, html).catch((err) =>
        logger.error('Service request resolution email failed', {
          requestId: request._id.toString(), err: err.message,
        })
      );
    }

    return request;
  }

  async resolveRequest(requestId, resolutionNotes) {
    return this.updateStatus(requestId, 'resolved', resolutionNotes);
  }

  async markInProgress(requestId) {
    return this.updateStatus(requestId, 'in_progress');
  }
}

module.exports = new ServiceRequestService();
