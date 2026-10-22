// utils/htmlSecurity.js
//
// HTML escaping + sanitization + header cleaning + email validation utilities.
//
// Four tools, four jobs — do NOT mix them up:
//
//   escapeHtml(x)     → KEEPS everything, encodes < > & " ' as entities.
//                       Right when you want to DISPLAY raw input as text.
//
//   sanitizeHtml(x)   → STRIPS all HTML tags, returns plain text.
//                       Right when you want to REMOVE markup entirely.
//
//   sanitizeHeader(x) → Strips CR/LF and trims. Right when the string will
//                       go into a header-like context (email subject, log
//                       field, HTTP header value) where newlines would
//                       break parsing or allow header injection.
//
//   NodemailerSecurity → Email validation and RFC 5322 header building.
//
// For rich HTML from users (WYSIWYG content with formatting), use a real
// sanitizer library (`sanitize-html` on server, `DOMPurify` in browser).
// Regex cannot safely implement an allowlist-based HTML sanitizer.

const MAX_ESCAPE_LENGTH = 100_000;   // 100 KB — truncate beyond this
const TRUNCATION_MARKER = '…[truncated]';

// Control chars that should never appear in text we render.
// Excludes \t (0x09), \n (0x0A), \r (0x0D) — legitimate whitespace.
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

// ─────────────────────────────────────────────────────────────
//  ESCAPE — keep everything, encode HTML special chars
// ─────────────────────────────────────────────────────────────

/**
 * Escape HTML special characters so a string can be safely interpolated
 * into HTML text or attribute context.
 *
 * NOT idempotent: escapeHtml(escapeHtml(x)) !== escapeHtml(x).
 * Escape exactly once, at the point of rendering.
 *
 * @param {*} unsafe
 * @returns {string}
 */
const escapeHtml = (unsafe) => {
  if (unsafe == null) return '';
  let str = typeof unsafe === 'string' ? unsafe : String(unsafe);

  if (str.length > MAX_ESCAPE_LENGTH) {
    str = str.slice(0, MAX_ESCAPE_LENGTH) + TRUNCATION_MARKER;
  }

  return str
    .replace(CONTROL_CHARS, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * escapeHtml with optional extra encoding for email-context strings.
 * Not exported (see module.exports below) — kept for internal use only.
 */
const escapeHtmlEnhanced = (unsafe, options = {}) => {
  let result = escapeHtml(unsafe);
  if (options.isEmailContext) {
    result = result
      .replace(/:/g, '&#58;')
      .replace(/;/g, '&#59;');
  }
  return result;
};

// ─────────────────────────────────────────────────────────────
//  SANITIZE — strip ALL HTML, return plain text
// ─────────────────────────────────────────────────────────────

/**
 * Strip all HTML tags (and their contents for script/style) from a string,
 * returning plain text.
 *
 * ⚠️ This is a BLUNT sanitizer — it removes ALL HTML, both dangerous and
 * safe. Use `sanitize-html` or `DOMPurify` if you need to preserve rich
 * HTML from user input.
 *
 * @param {*} unsafe
 * @returns {string} Plain text, no HTML tags
 */
const sanitizeHtml = (unsafe) => {
  if (unsafe == null) return '';
  let str = typeof unsafe === 'string' ? unsafe : String(unsafe);

  if (str.length > MAX_ESCAPE_LENGTH) {
    str = str.slice(0, MAX_ESCAPE_LENGTH) + TRUNCATION_MARKER;
  }

  str = str.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  str = str.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  str = str.replace(/<!--[\s\S]*?-->/g, '');
  str = str.replace(/<\/?[a-zA-Z][^>]*>/g, '');
  str = str.replace(CONTROL_CHARS, '');

  return str.trim();
};

// ─────────────────────────────────────────────────────────────
//  SANITIZE HEADER — strip CR/LF, trim (for header-like strings)
// ─────────────────────────────────────────────────────────────

/**
 * Sanitize a string that will be used in a header-like context — email
 * subject, HTTP header value, log field, etc. — where embedded CR/LF
 * would break parsing or allow header injection.
 *
 * Strips CR and LF, replaces them with a single space (to preserve
 * readability if the original had line breaks), then trims.
 *
 * Example: `"Hi\r\nBcc: attacker@evil.com"` → `"Hi Bcc: attacker@evil.com"`
 * The Bcc line no longer exists as a separate line, so it can't be
 * interpreted as a new header by an SMTP server or log parser.
 *
 * @param {*} str
 * @returns {string}
 */
const sanitizeHeader = (str) =>
  String(str ?? '').replace(/[\r\n]+/g, ' ').trim();

// ─────────────────────────────────────────────────────────────
//  Email validation & sanitization for Nodemailer
// ─────────────────────────────────────────────────────────────
const NodemailerSecurity = {
  validateEmailForNodemailer: (email) => {
    if (typeof email !== 'string') {
      return { isValid: false, sanitized: '', error: 'Email must be a string' };
    }

    const trimmed = email.trim();

    if (trimmed.length > 254) {
      return { isValid: false, sanitized: '', error: 'Email address too long' };
    }

    const colonCount = (trimmed.match(/:/g) || []).length;
    if (colonCount > 5) {
      return {
        isValid: false,
        sanitized: '',
        error: 'Invalid email format: too many special characters',
      };
    }

    const dangerousPatterns = [
      /(:.*){6,}/,
      /(;.*){6,}/,
      /(@.*){2,}/,
      /(,.*){10,}/,
      /(\s.*){20,}/,
      /\(.*\)/,
      /\[.*\]/,
      /\{.*\}/,
      /<.*>/,
      /%0[aA]/,
      /%0[dD]/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(trimmed)) {
        return {
          isValid: false,
          sanitized: '',
          error: 'Invalid email format: contains unsafe characters',
        };
      }
    }

    const parts = trimmed.split('@');
    if (parts.length !== 2) {
      return { isValid: false, sanitized: '', error: 'Invalid email format' };
    }

    const [localPart, domain] = parts;

    if (!localPart || localPart.length > 64) {
      return { isValid: false, sanitized: '', error: 'Invalid email local part' };
    }

    if (!domain || domain.length > 255) {
      return { isValid: false, sanitized: '', error: 'Invalid email domain' };
    }

    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!emailRegex.test(trimmed)) {
      return { isValid: false, sanitized: '', error: 'Invalid email format' };
    }

    return { isValid: true, sanitized: trimmed.toLowerCase(), error: null };
  },

  validateEmailList: (emails) => {
    const list = Array.isArray(emails) ? emails : [emails];
    const sanitized = [];
    const errors = [];

    for (const email of list) {
      const result = NodemailerSecurity.validateEmailForNodemailer(email);
      if (result.isValid) sanitized.push(result.sanitized);
      else                errors.push(result.error);
    }

    return { isValid: errors.length === 0, sanitized, errors };
  },

  isEmailSafe: (email) =>
    NodemailerSecurity.validateEmailForNodemailer(email).isValid,

  safeEmailHeader: (name, email) => {
    const validated = NodemailerSecurity.validateEmailForNodemailer(email);
    if (!validated.isValid) return null;

    const rawName = name == null ? '' : String(name).trim();
    if (!rawName) return validated.sanitized;

    const escapedName = rawName
      .replace(CONTROL_CHARS, '')
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');

    return `"${escapedName}" <${validated.sanitized}>`;
  },
};

module.exports = {
  escapeHtml,
  sanitizeHtml,
  sanitizeHeader,
  NodemailerSecurity,
};
