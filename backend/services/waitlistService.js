const Waitlist = require('../models/Waitlist');
const Event = require('../models/Event');
const { sendSMS, sendEmail } = require('./notificationService'); // <-- ADD

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

    // ─── Send SMS confirmation to the user ──────────────────
    const smsText = `You've joined the waitlist for ${ticketType.toUpperCase()} tickets at ${event.title}. We'll notify you when tickets become available.`;
    await sendSMS(phone, smsText).catch(err => console.error('Waitlist SMS failed', err));

    // send email confirmation
    await sendEmail(email, `Waitlist confirmed for ${event.title}`, `<p>You are now on the waitlist for ${ticketType.toUpperCase()} tickets.</p>`);

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

    // Send SMS to every entry
    for (const entry of entries) {
      entry.notified = true;
      await entry.save();

      const smsText = `Good news! ${ticketType.toUpperCase()} tickets for ${event.title} are now available. Purchase quickly at ${process.env.FRONTEND_URL}/event/${event._id}.`;
      await sendSMS(entry.phone, smsText).catch(err => console.error('Waitlist notify SMS failed', err));

      // send email as well
       const emailHtml = `<h2>${event.title} tickets are now available!</h2><p>Your ${ticketType.toUpperCase()} waitlist spot is ready. <a href="${process.env.FRONTEND_URL}/event/${event._id}">Book now</a> before they sell out.</p>`;
       await sendEmail(entry.email, `Tickets now available: ${event.title}`, emailHtml).catch(err => console.error('Waitlist notify email failed', err));
    }

    return { notified: entries.length };
  }
}

module.exports = new WaitlistService();
