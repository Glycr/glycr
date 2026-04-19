const { v4: uuidv4 } = require('uuid');
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const User = require('../models/User');
const notificationService = require('./notificationService');   // combined service

class TicketService {
  async purchaseTicket(userId, eventId, ticketType, quantity, paymentDetails, groupBooking = {}) {
    const event = await Event.findById(eventId);
    if (!event) throw new Error('Event not found');
    if (event.isCancelled) throw new Error('Event cancelled');

    const ticketTypes = event.ticketTypes;
    const typeData = ticketTypes.get(ticketType);
    if (!typeData) throw new Error('Invalid ticket type');

    const sold = typeData.sold || 0;
    const available = typeData.capacity - sold;
    if (quantity > available) throw new Error('Not enough tickets available');

    let pricePerTicket = typeData.price;
    let discount = 0;
    if (quantity >= 5) {
      discount = (typeData.groupDiscount || 10) / 100;
      pricePerTicket = pricePerTicket * (1 - discount);
    }

    // Update sold count
    typeData.sold = sold + quantity;
    await event.save();

    // Create all tickets
    const purchasedTickets = [];
    for (let i = 0; i < quantity; i++) {
      const ticketId = uuidv4();
      const ticket = new Ticket({
        id: ticketId,
        eventId,
        userId,
        ticketType,
        price: pricePerTicket,
        userEmail: paymentDetails.email,
        userPhone: paymentDetails.phone,
        companyName: groupBooking.companyName || '',
        billingAddress: groupBooking.billingAddress || '',
        poNumber: groupBooking.poNumber || '',
        validated: false,
        status: 'active',
      });
      await ticket.save();
      purchasedTickets.push(ticket);
    }

    // Send notifications for each ticket (once)
    for (const ticket of purchasedTickets) {
      const emailHtml = `
        <h2>Your Glycr Ticket</h2>
        <p>Thank you for purchasing a ticket to <strong>${event.title}</strong>.</p>
        <p>Ticket ID: ${ticket.id}</p>
        <p>Type: ${ticket.ticketType.toUpperCase()}</p>
        <p>Price: ₵${ticket.price}</p>
        <p>Date: ${new Date(event.date).toLocaleString()}</p>
        <p>Venue: ${event.venue}, ${event.location}</p>
        <p>Present this QR code at the entrance.</p>
      `;
      const emailText = `Your Glycr Ticket for ${event.title}. Ticket ID: ${ticket.id}. Price: ₵${ticket.price}. Date: ${new Date(event.date).toLocaleString()}. Venue: ${event.venue}, ${event.location}.`;
      const smsText = `Glycr: Your ticket for ${event.title} (${ticket.ticketType}) is confirmed. Ticket ID: ${ticket.id}. Show this QR code at the entrance.`;

      await notificationService.sendEmail({
        to: ticket.userEmail,
        subject: `Your Ticket for ${event.title}`,
        html: emailHtml,
        text: emailText,
      }).catch(err => console.error('Email send failed', err));

      await notificationService.sendSMS({
        to: ticket.userPhone,
        body: smsText,
      }).catch(err => console.error('SMS send failed', err));
    }

    return purchasedTickets;
  }

  async getUserTickets(userId) {
    const tickets = await Ticket.find({ userId }).populate('eventId', 'title currency');
    return tickets;
  }

  async validateTicketAtDoor(ticketId, eventId) {
    const ticket = await Ticket.findOne({ id: ticketId });
    if (!ticket) throw new Error('Ticket not found');
    if (ticket.eventId.toString() !== eventId) throw new Error('Ticket not for this event');
    if (ticket.status !== 'active') throw new Error('Ticket already used or cancelled');
    ticket.status = 'used';
    ticket.validated = true;
    await ticket.save();
    return ticket;
  }

  async validateTicket(ticketId) {
    const ticket = await Ticket.findOne({ id: ticketId });
    if (!ticket) throw new Error('Ticket not found');
    if (ticket.status !== 'active') throw new Error('Ticket already used or cancelled');
    ticket.status = 'used';
    ticket.validated = true;
    await ticket.save();
    return ticket;
  }

  async cancelTicket(ticketId) {
    const ticket = await Ticket.findOne({ id: ticketId });
    if (!ticket) throw new Error('Ticket not found');
    if (ticket.status !== 'active') throw new Error('Ticket already used or cancelled');
    ticket.status = 'cancelled';
    await ticket.save();
    return ticket;
  }

  async getEventTickets(eventId) {
    const tickets = await Ticket.find({ eventId }).populate('userId', 'name email');
    return tickets;
  }
}

module.exports = new TicketService();
