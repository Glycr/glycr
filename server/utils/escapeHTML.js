// utils/escapeHtml.js - Enhanced with Nodemailer DoS protection
const escapeHtml = (unsafe) => {
  if (unsafe == null) return '';
  if (typeof unsafe !== 'string') {
    unsafe = String(unsafe);
  }
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// Nodemailer-specific DoS protection utilities
const NodemailerSecurity = {
  /**
   * Validate and sanitize email address to prevent Nodemailer DoS attacks
   * Protects against: g0: g1: g2: ... g5000: attacker@evil.com
   * @param {string} email - Raw email input
   * @returns {Object} {isValid: boolean, sanitized: string, error: string|null}
   */
  validateEmailForNodemailer: (email) => {
    if (typeof email !== 'string') {
      return {
        isValid: false,
        sanitized: '',
        error: 'Email must be a string'
      };
    }

    const trimmed = email.trim();

    // 1. Check length (RFC 5321 limits)
    if (trimmed.length > 254) {
      return {
        isValid: false,
        sanitized: '',
        error: 'Email address too long'
      };
    }

    // 2. CRITICAL: Check for Nodemailer DoS patterns (excessive colons)
    const colonCount = (trimmed.match(/:/g) || []).length;
    if (colonCount > 5) {
      return {
        isValid: false,
        sanitized: '',
        error: 'Invalid email format: too many special characters'
      };
    }

    // 3. Check for other problematic patterns
    const dangerousPatterns = [
      /(:.*){6,}/,        // More than 5 colons (DoS pattern)
      /(;.*){6,}/,        // More than 5 semicolons
      /(@.*){2,}/,        // Multiple @ symbols
      /(,.*){10,}/,       // Excessive commas
      /(\s.*){20,}/,      // Excessive whitespace
      /\(.*\)/,           // Parentheses (can cause parsing issues)
      /\[.*\]/,           // Brackets
      /\{.*\}/,           // Curly braces
      /<.*>/,             // Angle brackets
      /%0[aA]/,           // Encoded newlines
      /%0[dD]/,           // Encoded carriage returns
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(trimmed)) {
        return {
          isValid: false,
          sanitized: '',
          error: 'Invalid email format: contains unsafe characters'
        };
      }
    }

    // 4. Basic email structure validation
    const parts = trimmed.split('@');
    if (parts.length !== 2) {
      return {
        isValid: false,
        sanitized: '',
        error: 'Invalid email format'
      };
    }

    const [localPart, domain] = parts;

    // Check local part length (RFC 5321: max 64 chars)
    if (!localPart || localPart.length > 64) {
      return {
        isValid: false,
        sanitized: '',
        error: 'Invalid email local part'
      };
    }

    // Check domain length and structure
    if (!domain || domain.length > 255) {
      return {
        isValid: false,
        sanitized: '',
        error: 'Invalid email domain'
      };
    }

    // 5. Final format validation (simplified for performance)
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

    if (!emailRegex.test(trimmed)) {
      return {
        isValid: false,
        sanitized: '',
        error: 'Invalid email format'
      };
    }

    return {
      isValid: true,
      sanitized: trimmed.toLowerCase(),
      error: null
    };
  },

  /**
   * Sanitize email list for Nodemailer (multiple emails)
   * @param {string|string[]} emails - Single email or array of emails
   * @returns {Object} {isValid: boolean, sanitized: string[], errors: string[]}
   */
  validateEmailList: (emails) => {
    const emailArray = Array.isArray(emails) ? emails : [emails];
    const sanitized = [];
    const errors = [];

    for (const email of emailArray) {
      const result = NodemailerSecurity.validateEmailForNodemailer(email);
      if (result.isValid) {
        sanitized.push(result.sanitized);
      } else {
        errors.push(result.error);
      }
    }

    return {
      isValid: errors.length === 0,
      sanitized: sanitized,
      errors: errors
    };
  },

  /**
   * Safe email header construction (prevents header injection)
   * @param {string} name - Display name
   * @param {string} email - Email address
   * @returns {string} Safe email header format
   */
  safeEmailHeader: (name, email) => {
    const validatedEmail = NodemailerSecurity.validateEmailForNodemailer(email);
    if (!validatedEmail.isValid) {
      return validatedEmail.sanitized || '';
    }

    const safeName = escapeHtml(name).replace(/[<>"']/g, '');

    if (!safeName || safeName === email) {
      return validatedEmail.sanitized;
    }

    return `"${safeName}" <${validatedEmail.sanitized}>`;
  },

  /**
   * Quick validation for Express middleware
   * @param {string} email - Email to validate
   * @returns {boolean} True if email is safe for Nodemailer
   */
  isEmailSafe: (email) => {
    if (typeof email !== 'string') return false;

    // Quick checks for common DoS patterns
    const unsafePatterns = [
      /(:.*){6,}/,  // Excessive colons (main DoS vector)
      /;/,           // Semicolons can cause issues
      /\(.*\)/,      // Parentheses
      /</,           // Angle brackets
      />/,
      /\[/,          // Brackets
      /\]/,
      /\{/,          // Curly braces
      /\}/,
      /\n/,          // Newlines
      /\r/,          // Carriage returns
    ];

    for (const pattern of unsafePatterns) {
      if (pattern.test(email)) return false;
    }

    return email.includes('@') && email.length <= 254;
  }
};

// Enhanced escapeHtml with email-specific escaping
const escapeHtmlEnhanced = (unsafe, options = {}) => {
  if (unsafe == null) return '';
  if (typeof unsafe !== 'string') {
    unsafe = String(unsafe);
  }

  let result = unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  // Additional protections if it might be an email
  if (options.isEmailContext) {
    // Remove Nodemailer DoS patterns even in escaped form
    result = result.replace(/:/g, '&#58;'); // Escape colons
    result = result.replace(/;/g, '&#59;'); // Escape semicolons
  }

  return result;
};

module.exports = {
  escapeHtml: escapeHtmlEnhanced,
  NodemailerSecurity,
  // Backward compatibility
  default: escapeHtmlEnhanced
};
