const Review = require('../models/Review');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const { AppError } = require('../utils/appError');
const { isObjectIdString } = require('../utils/validators');



class ReviewService {
  async createReview(userId, { eventId, rating, text } = {}) {
    if (!userId) throw new AppError('Authentication required', 401);
    if (!isObjectIdString(eventId)) {
      throw new AppError('Invalid event', 400);
    }

    const stars = Number(rating);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      throw new AppError('rating must be a whole number between 1 and 5', 400);
    }
    const body = typeof text === 'string' ? text.trim() : '';
    if (!body) throw new AppError('Review text is required', 400);
    if (body.length > 1000) throw new AppError('Review must be 1000 characters or fewer', 400);

    const event = await Event.findById(eventId).select('date isCancelled').lean();
    if (!event) throw new AppError('Event not found', 404);
    if (event.isCancelled) throw new AppError('Cancelled events cannot be reviewed', 400);
    if (new Date(event.date) > new Date()) {
      throw new AppError('You can review an event after it has taken place', 400);
    }

    // only people who hold a (non-refunded) ticket can review
    const hasTicket = await Ticket.exists({ eventId, userId, refunded: { $ne: true } });
    if (!hasTicket) throw new AppError('Only ticket holders can review this event', 403);

    let review;
    try {
      review = await Review.create({ userId, eventId, rating: stars, text: body });
    } catch (err) {
      if (err.code === 11000) throw new AppError('You have already reviewed this event', 409);
      throw err;
    }

    await Ticket.updateMany({ eventId, userId }, { $set: { reviewed: true } });
    return review;
  }

  async getMyReviews(userId) {
    if (!userId) throw new AppError('Authentication required', 401);

    const reviews = await Review.find({ userId }).sort({ createdAt: -1 }).lean();
    const events = await Event.find({ _id: { $in: reviews.map((r) => r.eventId) } })
      .select('title')
      .lean();
    const titles = new Map(events.map((e) => [String(e._id), e.title]));

    // plain shape the frontend expects (eventId as a string, title included)
    return reviews.map((r) => ({
      _id: r._id,
      eventId: String(r.eventId),
      eventTitle: titles.get(String(r.eventId)) || 'Event',
      rating: r.rating,
      text: r.text,
      createdAt: r.createdAt,
    }));
  }
}

module.exports = new ReviewService();
