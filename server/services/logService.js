const Log = require('../models/Log');
const User = require('../models/User');
const { logger } = require('../config/logger');

const LEVEL_MAP = { danger: 'error', warning: 'warn' }; // everything else -> info
const MAX_LIMIT = 500;
const MAX_META_CHARS = 4000;
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const clampMeta = (meta) => {
  try {
    const json = JSON.stringify(meta ?? {});
    return json.length <= MAX_META_CHARS ? meta : { truncated: true, preview: json.slice(0, 500) };
  } catch {
    return { unserializable: true };
  }
};

// Drop undefined values so they are not stored as null
const compact = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

// action -> the message shown in the panel, and what the audit "target" is:
//   target: 'user'  -> meta gets targetUser (email), targetUsername, targetRole
//   target: 'event' -> meta gets eventId and title
//   no target kind  -> meta.target holds the raw target (an id, a code...)
// Actions not listed here fall back to a readable version of the action name.
const A = (message, target) => ({ message, target });
const ACTIONS = {
  // users
  create_user:    A('New user created by admin', 'user'),
  update_user:    A('User details updated', 'user'),
  suspend_user:   A('User suspended', 'user'),
  unsuspend_user: A('User unsuspended', 'user'),
  delete_user:    A('User deleted', 'user'),
  change_role:    A('User role changed', 'user'),
  // events
  create_event:    A('Event created', 'event'),
  update_event:    A('Event details edited', 'event'),
  delete_event:    A('Event deleted', 'event'),
  flag_event:      A('Event flagged', 'event'),
  unflag_event:    A('Event unflagged', 'event'),
  publish_event:   A('Event published', 'event'),
  unpublish_event: A('Event unpublished', 'event'),
  cancel_event:    A('Event cancelled', 'event'),
  // payouts and refunds
  request_payout: A('Payout requested'),
  approve_payout: A('Payout approved'),
  reject_payout:  A('Payout rejected'),
  request_refund: A('Refund requested'),
  approve_refund: A('Refund approved'),
  reject_refund:  A('Refund rejected'),
  // coupons
  create_coupon: A('Coupon created'),
  delete_coupon: A('Coupon deleted'),
  // waitlist
  join_waitlist:         A('Joined waitlist'),
  notify_waitlist:       A('Waitlist notified'),
  convert_waitlist:      A('Waitlist entry converted to ticket'),
  delete_waitlist_entry: A('Waitlist entry deleted'),
  // messages
  send_direct_message: A('Direct message sent'),
  send_broadcast:      A('Broadcast sent'),
  delete_message:      A('Message deleted'),
  // service requests
  create_service_request:           A('Service request created'),
  update_service_request_status:    A('Service request status updated'),
  resolve_service_request:          A('Service request resolved'),
  mark_service_request_in_progress: A('Service request marked in progress'),
  // tickets
  purchase_tickets: A('Tickets purchased'),
  validate_ticket:  A('Ticket validated'),
  cancel_ticket:    A('Ticket cancelled'),
  scan_rejected:    A('Ticket scan rejected'),
  // staff
  create_staff:     A('Staff member created'),
  set_staff_status: A('Staff status changed'),
  delete_staff:     A('Staff member deleted'),
  // settings and logs
  update_settings: A('Settings updated'),
  clear_logs:      A('Logs cleared'),
  // auth
  // auth
  register:                 A('Account registered'),
  login:                    A('Logged in'),
  login_failed:             A('Login failed'),
  update_profile:           A('Profile updated'),
  password_reset_requested: A('Password reset requested'),
  reset_password:           A('Password reset'),
  change_password:          A('Password changed'),
  change_password_failed:   A('Password change failed'),
  account_locked:           A('Account locked after failed logins'),
  // access control
  'access-denied':          A('Access denied'),
  'cross-organizer-access': A("Blocked access to another organizer's event"),
};

const humanize = (action) => {
  const s = String(action || 'action').replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

class LogService {
  // MongoDB + winston. Throws on DB failure.
  async addLog(type, message, meta = {}, adminId = null, fields = {}) {
    const level = LEVEL_MAP[type] || 'info';
    const log = await Log.create({
      type,
      level,
      message,
      meta: clampMeta(meta),
      adminId: OBJECT_ID.test(String(adminId)) ? adminId : undefined,
      ...fields, // actor, action, target, ip
    });
    // Same shape as the panel's own entries: message, then { type, actor, ip, meta }
    logger.log(level, message, { type, actor: fields.actor, ip: fields.ip, meta });
    return log;
  }

  // Winston only: no MongoDB write (view events, noise)
  trace(type, message, meta = {}) {
    logger.log(LEVEL_MAP[type] || 'info', message, { type, meta });
  }

  // Never throws, so logging can't break a request.
  // actor = name/email snapshot (not an id); put the id in extra.adminId.
  async audit(actor, action, target, extra = {}) {
    let { type = 'event', ip, userAgent, adminId, role, targetName, ...rest } = extra;
    const info = ACTIONS[action] || { message: humanize(action) };
    const actorName = String(actor || 'system');

    // Validate `type` against the Log model's enum BEFORE creating the doc.
    // Without this check, an unknown `type` silently loses the audit entry:
    // Log.create throws on the enum mismatch, the try/catch below swallows
    // the error, and the caller never sees the failure. Falling back to
    // 'system' preserves the entry (with action, target, actor, meta intact)
    // so nothing disappears; the warning tells you which callsite needs fixing.
    const validTypes = Log.schema.path('type').enumValues;
    if (!validTypes.includes(type)) {
      logger.warn('Unknown audit type — falling back to system', {
        received: type,
        action,
        validTypes,
      });
      type = 'system';
    }

    try {
      // The JWT only carries id, email and role, so the admin's name comes from the database
      const admin = OBJECT_ID.test(String(adminId))
        ? await User.findById(adminId).select('name role').lean()
        : null;

      const meta = { adminName: admin?.name, adminRole: admin?.role || role };

      if (info.target === 'user') {
        meta.targetUser = target;
        // A deleted user can't be looked up, so callers may pass targetName instead
        meta.targetUsername = targetName
          ?? (typeof target === 'string'
            ? (await User.findOne({ email: target }).select('name').lean())?.name
            : undefined);
        meta.targetRole = rest.targetRole;
      } else if (info.target === 'event') {
        meta.eventId = rest.eventId;
        meta.title = target;
      } else if (target) {
        meta.target = target;
      }

      Object.assign(meta, rest); // anything else the caller passed (amount, channel, submittedFields...)

      return await this.addLog(
        type,
        info.message,
        compact(meta),
        adminId,
        { actor: actorName, action, target: target ? String(target) : undefined, ip }
      );
    } catch (err) {
      logger.error('Audit log failed', { err: err.message, action, type });
      return null;
    }
  }

  async getLogs({ type, search, sort = 'desc', limit = 100, page = 1 } = {}) {
    limit = Math.min(Math.max(Number(limit) || 100, 1), MAX_LIMIT);
    page = Math.max(Number(page) || 1, 1);

    const query = {};
    if (typeof type === 'string' && type !== 'all') query.type = type; // strings only: blocks ?type[$ne]=x
    if (typeof search === 'string' && search.trim()) {
      const rx = new RegExp(escapeRegex(search.trim().slice(0, 100)), 'i');
      query.$or = [{ message: rx }, { actor: rx }, { action: rx }, { target: rx }];
    }

    const [docs, total] = await Promise.all([
      Log.find(query)
        .sort({ timestamp: sort === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('adminId', 'name email')
        .lean(),
      Log.countDocuments(query),
    ]);

    const logs = docs.map((l) => ({ ...l, id: String(l._id) })); // lean() drops virtuals
    return { logs, total, page, limit };
  }

  async clearLogs(adminId, actor = adminId) {
    const { deletedCount } = await Log.deleteMany({});
    await this.audit(actor, 'clear_logs', 'logs', { type: 'warning', adminId, deletedCount });
    return true;
  }
}

module.exports = new LogService();
