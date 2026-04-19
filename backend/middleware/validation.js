const Joi = require('joi');

// Register schema
const registerSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  username: Joi.string().required(),
  phone: Joi.string().pattern(/^\+233\d{9}$/).required(),
  isOrganizer: Joi.boolean().default(false),
  currency: Joi.string().valid('USD', 'EUR', 'GBP', 'CAD', 'GHC').default('GHC'),
});

// Login schema
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// Update profile schema
const updateProfileSchema = Joi.object({
  name: Joi.string().optional(),
  email: Joi.string().email().optional(),
  phone: Joi.string().pattern(/^\+233\d{9}$/).optional(),
  currency: Joi.string().valid('USD', 'EUR', 'GBP', 'CAD', 'GHC').optional(),
});

// Event schema
const eventSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().required(),
  date: Joi.date().iso().required(),
  venue: Joi.string().required(),
  location: Joi.string().optional(),
  category: Joi.string().required(),
  currency: Joi.string().valid('USD', 'EUR', 'GBP', 'CAD', 'GHC').required(),
  ticketTypes: Joi.object().pattern(
    Joi.string(),
    Joi.object({
      price: Joi.number().min(0).required(),
      capacity: Joi.number().integer().min(1).required(),
      earlyBirdPrice: Joi.number().min(0).optional(),
      earlyBirdEnd: Joi.date().iso().optional(),
      groupDiscount: Joi.number().min(0).max(50).default(10),
    })
  ).required(),
  image: Joi.string().optional(),
  lat: Joi.number().optional(),
  lng: Joi.number().optional(),
  address: Joi.string().optional(),
});

// Waitlist schema
const waitlistSchema = Joi.object({
  eventId: Joi.string().required(), // changed from number to string for ObjectId
  ticketType: Joi.string().required(),
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^\+233\d{9}$/).required(),
});

// Payout schema
const payoutSchema = Joi.object({
  amount: Joi.number().min(10).required(),
  method: Joi.string().valid('bank', 'momo', 'paypal').required(),
  email: Joi.string().email().required(),
  notes: Joi.string().optional(),
  bankDetails: Joi.when('method', {
    is: 'bank',
    then: Joi.object({
      bankName: Joi.string().required(),
      accountNumber: Joi.string().required(),
      accountName: Joi.string().required(),
    }).required(),
    otherwise: Joi.forbidden(),
  }),
  momoDetails: Joi.when('method', {
    is: 'momo',
    then: Joi.object({
      phone: Joi.string().pattern(/^\+233\d{9}$/).required(),
    }).required(),
    otherwise: Joi.forbidden(),
  }),
});

// Generic validation middleware factory
const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const messages = error.details.map(detail => detail.message).join(', ');
    return res.status(400).json({ error: messages });
  }
  next();
};

// For express-validator style sanitization (if needed, but not used in this file)
// We'll keep a dummy export for compatibility
const sanitizeText = (field) => (req, res, next) => { next(); }; // placeholder

module.exports = {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  eventSchema,
  waitlistSchema,
  payoutSchema,
  validate,
  sanitizeText,
};
