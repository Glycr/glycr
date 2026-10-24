// services/waitlistService.js
const Waitlist = require('../models/Waitlist');
const Event    = require('../models/Event');
const { sendSMS, sendEmail } = require('./notificationService');
const { AppError } = require('../utils/appError');
const { logger } = require('../config/logger');
const { escapeHtml, sanitizeHeader } = require('../utils/htmlSecurity');

const MAX_NOTIFY_BATCH = 200;
const NOTIFY_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour between re-notifications

const isEmail = (e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const isPhone = (p) => typeof p === 'string' && p.length >= 7 && p.length <= 20;

const frontendUrl = () =>
  (process.env.FRONTEND_URL || 'http://localhost:63342/Glycr/frontend').replace(/\/+$/, '');

class WaitlistService {
  async joinWaitlist(eventId, ticketType, name, email, phone) {
    // ── Validate inputs ──
    if (!eventId) throw new AppError('eventId is required', 400);
    if (!ticketType || typeof ticketType !== 'string') {
      throw new AppError('ticketType is required', 400);
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new AppError('name is required', 400);
    }
    if (!isEmail(email)) throw new AppError('A valid email is required', 400);
    if (!isPhone(phone)) throw new AppError('A valid phone number is required', 400);

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedPhone = phone.trim();

    const event = await Event.findById(eventId);
    if (!event) throw new AppError('Event not found', 404);
    if (event.isCancelled) throw new AppError('Event cancelled', 400);

    // ── Validate ticket type exists AND is actually sold out ──
    const typeData = event.ticketTypes?.get?.(ticketType);
    if (!typeData) throw new AppError('Invalid ticket type', 400);
    const capacity = Number(typeData.capacity) || 0;
    const sold     = Number(typeData.sold) || 0;
    if (sold < capacity) {
      throw new AppError(
        `Tickets for ${ticketType} are still available — purchase directly instead of joining the waitlist`,
        400
      );
    }

    // ── Duplicate check (still a race, but we catch the unique-index error below) ──
    const existing = await Waitlist.findOne({
      eventId, ticketType, email: normalizedEmail,
    }).lean();
    if (existing) {
      return existing;
    }
    // ── Assign position (non-atomic, but display-only — order by joinedAt) ──
    const count = await Waitlist.countDocuments({ eventId, ticketType });
    const position = count + 1;

    const entry = new Waitlist({
      eventId,
      ticketType,
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      joinedAt: new Date(),
      notified: false,
      position,
    });

    try {
      await entry.save();
    } catch (err) {
      if (err.code === 11000) {
        throw new AppError('You are already on the waitlist for this ticket type', 409);
      }
      throw err;
    }

    // ── Notifications (best-effort, fire-and-forget) ──
    const smsText = `You've joined the waitlist for ${ticketType.toUpperCase()} tickets at ${event.title}. Your position is #${position}.`;
    const emailSubject = sanitizeHeader(`Waitlist confirmed for ${event.title}`);
    const emailHtml = `
      <p>You are now on the waitlist for <strong>${escapeHtml(ticketType.toUpperCase())}</strong> tickets.</p>
      <p>Position: <strong>#${position}</strong></p>
      <p>We'll email and text you as soon as tickets become available.</p>
    `;
    sendSMS(normalizedPhone, smsText).catch((err) =>
      logger.error('Waitlist join SMS failed', { email: normalizedEmail, err: err.message })
    );
    sendEmail(normalizedEmail, emailSubject, emailHtml).catch((err) =>
      logger.error('Waitlist join email failed', { email: normalizedEmail, err: err.message })
    );

    return entry;
  }

  async getAllWaitlists(filters = {}) {
    const query = {};
    if (filters.eventId) query.eventId = filters.eventId;

    const limit = Math.min(Number(filters.limit) || 200, 500);
    const skip  = Number(filters.skip) || 0;

    return Waitlist.find(query)
      .populate('eventId', 'title date venue')
      .sort({ joinedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  // Authority: admin can view any event's waitlist; organizer only their own.
  // actingUser = { id, isAdmin } from the JWT.
  async getWaitlist(eventId, ticketType, actingUser) {
    if (!eventId) throw new AppError('eventId is required', 400);
    if (!actingUser?.id) throw new AppError('Authentication required', 401);

    const event = await Event.findById(eventId).select('organizerId').lean();
    if (!event) throw new AppError('Event not found', 404);

    if (!actingUser.isAdmin) {
      if (String(event.organizerId) !== String(actingUser.id)) {
        throw new AppError('You do not have permission to view this waitlist', 403);
      }
    }

    const query = { eventId };
    if (ticketType) query.ticketType = ticketType;

    // Sorted by joinedAt — canonical queue order (position is display-only)
    return Waitlist.find(query).sort({ joinedAt: 1 }).lean();
  }

  // Authority: admin can notify any event's waitlist; organizer only their own.
  // actingUser = { id, isAdmin } from the JWT.
  async notifyWaitlist(eventId, ticketType, actingUser, { resend = false } = {}) {
    if (!eventId) throw new AppError('eventId is required', 400);
    if (!ticketType || typeof ticketType !== 'string') {
      throw new AppError('ticketType is required', 400);
    }
    if (!actingUser?.id) throw new AppError('Authentication required', 401);

    const event = await Event.findById(eventId);
    if (!event) throw new AppError('Event not found', 404);

    if (!actingUser.isAdmin) {
      if (String(event.organizerId) !== String(actingUser.id)) {
        throw new AppError('You do not have permission to notify this waitlist', 403);
      }
    }

    const query = { eventId, ticketType };
    if (!resend) query.notified = false;

    // Cap batch size — a 10k-entry waitlist would take minutes and hit SMS limits
    const entries = await Waitlist.find(query).sort({ joinedAt: 1 }).limit(MAX_NOTIFY_BATCH);

    if (!entries.length) {
      return { message: 'No waitlist entries to notify', notified: 0, failed: 0 };
    }

    const link = `${frontendUrl()}/event/${event._id}`;
    const subject = sanitizeHeader(`Tickets now available: ${event.title}`);
    const smsText = `Good news! ${ticketType.toUpperCase()} tickets for ${event.title} are now available. Purchase quickly at ${link}.`;
    const emailHtml = `
      <h2>${escapeHtml(event.title)} tickets are now available!</h2>
      <p>Your ${escapeHtml(ticketType.toUpperCase())} waitlist spot is ready.</p>
      <p><a href="${escapeHtml(link)}">Book now</a> before they sell out.</p>
    `;

    let notified = 0;
    let failed = 0;
    const notifiedAt = new Date();

    for (const entry of entries) {
      if (entry.notified && entry.notifiedAt) {
        const sinceMs = Date.now() - new Date(entry.notifiedAt).getTime();
        if (sinceMs < NOTIFY_COOLDOWN_MS) {
          continue;
        }
      }

      const results = await Promise.allSettled([
        sendSMS(entry.phone, smsText),
        sendEmail(entry.email, subject, emailHtml),
      ]);

      const anySuccess = results.some((r) => r.status === 'fulfilled');

      if (anySuccess) {
        entry.notified = true;
        entry.notifiedAt = notifiedAt;
        try {
          await entry.save();
          notified++;
        } catch (err) {
          logger.error('Waitlist notify: save failed after send', {
            entryId: entry._id.toString(), err: err.message,
          });
          failed++;
        }
      } else {
        failed++;
        const reasons = results
          .map((r) => (r.status === 'rejected' ? r.reason?.message : null))
          .filter(Boolean)
          .join(' | ');
        logger.error('Waitlist notify failed for entry', {
          entryId: entry._id.toString(), email: entry.email, reasons,
        });
      }
    }

    return {
      notified,
      failed,
      total: entries.length,
      remaining: await Waitlist.countDocuments({ eventId, ticketType, notified: false }),
    };
  }
}

module.exports = new WaitlistService();
