const Waitlist = require('../models/Waitlist');
const Event = require('../models/Event');

class WaitlistService {
  async joinWaitlist(eventId, ticketType, name, email, phone) {
    const event = await Event.findById(eventId);
    if (!event) throw new Error('Event not found');
    if (event.isCancelled) throw new Error('Event cancelled');

    const existing = await Waitlist.findOne({ eventId, ticketType, email });
    if (existing) throw new Error('Already on waitlist for this ticket type');

    const entry = new Waitlist({
      eventId,
      ticketType,
      name,
      email,
      phone,
      joinedAt: new Date(),
      notified: false,
    });
    await entry.save();
    return entry;
  }

  async getWaitlist(eventId, ticketType, organizerId) {
    const event = await Event.findById(eventId);
    if (!event) throw new Error('Event not found');
    if (event.organizerId.toString() !== organizerId) throw new Error('Unauthorized');

    const entries = await Waitlist.find({ eventId, ticketType }).sort('joinedAt');
    return entries;
  }

  async notifyWaitlist(eventId, ticketType, organizerId) {
    const event = await Event.findById(eventId);
    if (!event) throw new Error('Event not found');
    if (event.organizerId.toString() !== organizerId) throw new Error('Unauthorized');

    const entries = await Waitlist.find({ eventId, ticketType });
    if (entries.length === 0) return { message: 'No waitlist entries' };

    // Mark as notified (optional)
    for (const entry of entries) {
      entry.notified = true;
      await entry.save();
      // TODO: Send SMS/Email
      console.log(`Notify ${entry.phone} about ${ticketType} tickets for ${event.title}`);
    }

    return { notified: entries.length };
  }
}

module.exports = new WaitlistService();
