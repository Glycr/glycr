const Ticket = require('../models/Ticket');
const Event = require('../models/Event');

class AnalyticsService {
  async getSalesTrend(organizerId, days = 7) {
    // Get all events owned by this organizer
    const events = await Event.find({ organizerId });
    const eventIds = events.map(e => e._id);

    // Get all tickets for those events
    const tickets = await Ticket.find({ eventId: { $in: eventIds } });

    // Prepare last 'days' dates
    const labels = [];
    const ticketsData = [];
    const revenueData = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const nextDay = new Date(d);
      nextDay.setDate(d.getDate() + 1);

      labels.push(d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }));

      const dayTickets = tickets.filter(t => {
        const purchaseDate = new Date(t.purchasedAt);
        return purchaseDate >= d && purchaseDate < nextDay;
      });

      ticketsData.push(dayTickets.length);
      revenueData.push(dayTickets.reduce((sum, t) => sum + t.price, 0));
    }

    return { labels, tickets: ticketsData, revenue: revenueData };
  }
}

module.exports = new AnalyticsService();
