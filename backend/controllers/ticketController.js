// ============================================
// FILE: controllers/ticketController.js
// ============================================
const { generateTicketId, calculatePrice } = require('../utils/helpers');

exports.purchaseTicket = async (req, res) => {
  try {
    const {
      eventId,
      ticketType,
      quantity,
      paymentMethod,
      companyName,
      billingAddress,
      poNumber
    } = req.body;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const ticketTypeData = event.ticketTypes.get(ticketType);
    if (!ticketTypeData) {
      return res.status(400).json({ error: 'Invalid ticket type' });
    }

    const available = ticketTypeData.capacity - ticketTypeData.sold;
    if (quantity > available) {
      return res.status(400).json({ error: 'Not enough tickets available' });
    }

    const price = calculatePrice(ticketTypeData, quantity);

    const user = await User.findById(req.user.id);
    const tickets = [];

    for (let i = 0; i < quantity; i++) {
      const ticket = new Ticket({
        ticketId: generateTicketId(),
        eventId,
        userId: req.user.id,
        userEmail: user.email,
        userPhone: user.phone,
        ticketType,
        price,
        quantity: 1,
        companyName,
        billingAddress,
        poNumber,
        paymentMethod
      });

      await ticket.save();
      tickets.push(ticket);
    }

    ticketTypeData.sold += quantity;
    event.ticketTypes.set(ticketType, ticketTypeData);
    await event.save();

    await sendEmail(
      user.email,
      `Ticket Confirmation: ${event.title}`,
      `<h2>Your tickets are confirmed!</h2>
       <p>Event: ${event.title}</p>
       <p>Tickets: ${quantity} x ${ticketType.toUpperCase()}</p>
       <p>Total: ${event.currency} ${(price * quantity).toFixed(2)}</p>`
    );

    await sendSMS(
      user.phone,
      `Your ${quantity} ticket(s) for ${event.title} (${ticketType.toUpperCase()}) have been confirmed!`
    );

    res.status(201).json({
      message: 'Tickets purchased successfully',
      tickets,
      total: price * quantity
    });
  } catch (error) {
    console.error('Purchase ticket error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getMyTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find({ userId: req.user.id })
      .populate('eventId')
      .sort({ purchasedAt: -1 });

    res.json(tickets);
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.validateTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId })
      .populate('eventId');

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (ticket.eventId.organizerId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (ticket.validated) {
      return res.status(400).json({ error: 'Ticket already validated' });
    }

    ticket.validated = true;
    ticket.validatedAt = new Date();
    await ticket.save();

    res.json({ message: 'Ticket validated successfully', ticket });
  } catch (error) {
    console.error('Validate ticket error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
