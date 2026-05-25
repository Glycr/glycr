const Event = require('../models/Event');
const User = require('../models/User');

class EventService {
  async createEvent(organizerId, eventData, imageUrl = null) {
    const event = new Event({
      ...eventData,
      organizerId,
      image: imageUrl,
      isPublished: true,
      isCancelled: false,
      flagged: false,
    });
    await event.save();
    return event;
  }

  async getEventById(id) {
    const event = await Event.findById(id).populate('organizerId', '-password');
    if (!event) throw new Error('Event not found');
    return event;
  }

  async updateEvent(eventId, organizerId, updates, imageUrl = null) {
    const event = await Event.findById(eventId);
    if (!event) throw new Error('Event not found');
    if (event.organizerId.toString() !== organizerId) throw new Error('Unauthorized');

    if (imageUrl) updates.image = imageUrl;
    const updated = await Event.findByIdAndUpdate(eventId, updates, { new: true });
    return updated;
  }

  async deleteEvent(eventId, organizerId, isAdmin = false) {
    const event = await Event.findById(eventId);
    if (!event) throw new Error('Event not found');
    if (!isAdmin && event.organizerId.toString() !== organizerId) throw new Error('Unauthorized');

    await event.deleteOne();
    // Also delete associated tickets and waitlists? We'll handle in those services.
    return true;
  }

  async togglePublish(eventId, organizerId) {
    const event = await Event.findById(eventId);
    if (!event) throw new Error('Event not found');
    if (event.organizerId.toString() !== organizerId) throw new Error('Unauthorized');
    event.isPublished = !event.isPublished;
    await event.save();
    return event;
  }

  async cancelEvent(eventId, organizerId) {
    const event = await Event.findById(eventId);
    if (!event) throw new Error('Event not found');
    if (event.organizerId.toString() !== organizerId) throw new Error('Unauthorized');
    event.isCancelled = true;
    await event.save();
    // Notify ticket holders (email/SMS) – we'll keep as a comment for now
    return event;
  }

  async getEvents(filters = {}) {
    let query = {};
    const now = new Date();

    if (filters.search) {
      const search = filters.search.toLowerCase();
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }
    if (filters.category) query.category = filters.category;
    if (filters.location) query.location = filters.location;
    if (filters.upcoming) {
      query.date = { $gt: now };
      query.isCancelled = false;
      query.isPublished = true;
    }
    if (filters.organizerId) query.organizerId = filters.organizerId;
    if (filters.flagged) query.flagged = true;

    let events = await Event.find(query).populate('organizerId', '-password');
    return events;
  }

  async flagEvent(eventId) {
    const event = await Event.findByIdAndUpdate(eventId, { flagged: true }, { new: true });
    if (!event) throw new Error('Event not found');
    return event;
  }

  async unflagEvent(eventId) {
    const event = await Event.findByIdAndUpdate(eventId, { flagged: false }, { new: true });
    if (!event) throw new Error('Event not found');
    return event;
  }
}

module.exports = new EventService();
