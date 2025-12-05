// ============================================
// FILE: controllers/eventController.js
// ============================================
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const Waitlist = require('../models/Waitlist');
const { sendEmail } = require('../utils/email');
const { sendSMS } = require('../utils/sms');

exports.getAllEvents = async (req, res) => {
  try {
    const { category, location, search, status } = req.query;

    let query = { isCancelled: false, isPublished: true };

    if (category) query.category = category;
    if (location) query.location = location;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (status === 'upcoming') {
      query.date = { $gt: new Date() };
    }

    const events = await Event.find(query)
      .populate('organizerId', 'name email')
      .sort({ date: 1 });

    res.json(events);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('organizerId', 'name email phone');

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(event);
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      date,
      venue,
      location,
      category,
      currency,
      organizerEmail,
      organizerPhone,
      ticketTypes
    } = req.body;

    const parsedTicketTypes = new Map(Object.entries(JSON.parse(ticketTypes)));

    const event = new Event({
      title,
      description,
      date,
      venue,
      location,
      category,
      currency,
      organizerEmail,
      organizerPhone,
      image: req.file ? `/uploads/${req.file.filename}` : null,
      ticketTypes: parsedTicketTypes,
      organizerId: req.user.id
    });

    await event.save();

    res.status(201).json({ message: 'Event created successfully', event });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.organizerId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updates = { ...req.body };
    if (req.file) {
      updates.image = `/uploads/${req.file.filename}`;
    }
    if (updates.ticketTypes) {
      updates.ticketTypes = new Map(Object.entries(JSON.parse(updates.ticketTypes)));
    }

    const updatedEvent = await Event.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    );

    res.json({ message: 'Event updated', event: updatedEvent });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.organizerId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await Event.findByIdAndDelete(req.params.id);
    await Ticket.deleteMany({ eventId: req.params.id });
    await Waitlist.deleteMany({ eventId: req.params.id });

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.cancelEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.organizerId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    event.isCancelled = true;
    await event.save();

    const tickets = await Ticket.find({ eventId: req.params.id });
    for (const ticket of tickets) {
      await sendEmail(
        ticket.userEmail,
        `Event Cancelled: ${event.title}`,
        `<p>Unfortunately, ${event.title} has been cancelled. A full refund will be processed.</p>`
      );
      await sendSMS(ticket.userPhone, `${event.title} has been cancelled. Full refund processed.`);
    }

    res.json({ message: 'Event cancelled and notifications sent' });
  } catch (error) {
    console.error('Cancel event error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.shareEvent = async (req, res) => {
  try {
    await Event.findByIdAndUpdate(req.params.id, { $inc: { shareCount: 1 } });
    res.json({ message: 'Share tracked' });
  } catch (error) {
    console.error('Share event error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
