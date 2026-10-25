const Event = require('../models/Event');
const { AppError } = require('../utils/appError');
const { isObjectIdString } = require('../utils/validators');

const MAX_FEATURED = 6;

// events that are allowed to show in the carousel right now
const liveFilter = () => ({
  isPublished: true,
  isCancelled: { $ne: true },
  date: { $gt: new Date() },
});

class FeaturedService {
  async getFeaturedEvents() {
    return Event.find({ isFeatured: true, ...liveFilter() })
      .sort({ featuredOrder: 1, date: 1 })
      .limit(MAX_FEATURED)
      .lean();
  }

  async setFeatured(eventId, { featured, order } = {}) {
    if (!isObjectIdString(eventId)) throw new AppError('Invalid event', 400);
    if (typeof featured !== 'boolean') throw new AppError('featured must be true or false', 400);

    let featuredOrder;
    if (order !== undefined) {
      featuredOrder = Number(order);
      if (!Number.isInteger(featuredOrder) || featuredOrder < 0 || featuredOrder > 99) {
        throw new AppError('order must be a whole number between 0 and 99', 400);
      }
    }

    const event = await Event.findById(eventId).select('isFeatured featuredOrder isPublished isCancelled date').lean();
    if (!event) throw new AppError('Event not found', 404);

    if (featured) {
      if (!event.isPublished || event.isCancelled) {
        throw new AppError('Only published, active events can be featured', 400);
      }
      if (new Date(event.date) <= new Date()) {
        throw new AppError('Past events cannot be featured', 400);
      }
      if (!event.isFeatured) {
        const count = await Event.countDocuments({ isFeatured: true, ...liveFilter() });
        if (count >= MAX_FEATURED) {
          throw new AppError(`Up to ${MAX_FEATURED} events can be featured. Remove one first.`, 409);
        }
      }
    }

    return Event.findByIdAndUpdate(
      eventId,
      { $set: {
          isFeatured: featured,
          featuredOrder: featured ? (featuredOrder ?? event.featuredOrder ?? 0) : 0,
        } },
      { new: true }
    ).lean();
  }
}

module.exports = new FeaturedService();
