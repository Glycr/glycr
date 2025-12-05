// ============================================
// FILE: controllers/adminController.js
// ============================================
const { sendEmail } = require('../utils/email');

exports.getAllUsers = async (req, res) => {
  try {
    const { search, filter } = req.query;

    let query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (filter === 'organizers') query.isOrganizer = true;
    if (filter === 'suspended') query.suspended = true;

    const users = await User.find(query).select('-password').sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.suspendUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.suspended = !user.suspended;
    await user.save();

    res.json({ message: `User ${user.suspended ? 'suspended' : 'activated'}`, user });
  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    await Event.deleteMany({ organizerId: req.params.id });
    await Ticket.deleteMany({ userId: req.params.id });
    await Favorite.deleteMany({ userId: req.params.id });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getAllEvents = async (req, res) => {
  try {
    const { search, filter } = req.query;

    let query = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { venue: { $regex: search, $options: 'i' } }
      ];
    }

    if (filter === 'live') {
      query.isPublished = true;
      query.isCancelled = false;
      query.date = { $gt: new Date() };
    }
    if (filter === 'cancelled') query.isCancelled = true;
    if (filter === 'flagged') query.flagged = true;

    const events = await Event.find(query)
      .populate('organizerId', 'name email')
      .sort({ createdAt: -1 });

    res.json(events);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.flagEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    event.flagged = !event.flagged;
    await event.save();

    res.json({ message: `Event ${event.flagged ? 'flagged' : 'unflagged'}`, event });
  } catch (error) {
    console.error('Flag event error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getAllPayouts = async (req, res) => {
  try {
    const payouts = await Payout.find()
      .populate('organizerId', 'name email')
      .sort({ requestedAt: -1 });

    res.json(payouts);
  } catch (error) {
    console.error('Get payouts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.approvePayout = async (req, res) => {
  try {
    const payout = await Payout.findById(req.params.id);
    if (!payout) {
      return res.status(404).json({ error: 'Payout not found' });
    }

    payout.status = 'completed';
    payout.completedAt = new Date();
    await payout.save();

    await sendEmail(
      payout.email,
      'Payout Approved',
      `<p>Your payout request of ${payout.amount} has been approved and will be processed within 3-5 business days.</p>`
    );

    res.json({ message: 'Payout approved', payout });
  } catch (error) {
    console.error('Approve payout error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.rejectPayout = async (req, res) => {
  try {
    const { reason } = req.body;

    const payout = await Payout.findById(req.params.id);
    if (!payout) {
      return res.status(404).json({ error: 'Payout not found' });
    }

    payout.status = 'rejected';
    payout.rejectionReason = reason;
    await payout.save();

    await sendEmail(
      payout.email,
      'Payout Rejected',
      `<p>Your payout request has been rejected.</p><p>Reason: ${reason}</p>`
    );

    res.json({ message: 'Payout rejected', payout });
  } catch (error) {
    console.error('Reject payout error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalOrganizers = await User.countDocuments({ isOrganizer: true });
    const totalEvents = await Event.countDocuments();
    const liveEvents = await Event.countDocuments({
      isPublished: true,
      isCancelled: false,
      date: { $gt: new Date() }
    });
    const totalTickets = await Ticket.countDocuments();

    const tickets = await Ticket.find();
    const totalRevenue = tickets.reduce((sum, t) => sum + t.price, 0);

    const pendingPayouts = await Payout.find({ status: 'pending' });
    const pendingPayoutAmount = pendingPayouts.reduce((sum, p) => sum + p.amount, 0);

    const flaggedEvents = await Event.countDocuments({ flagged: true });

    res.json({
      totalUsers,
      totalOrganizers,
      totalEvents,
      liveEvents,
      totalTickets,
      totalRevenue,
      pendingPayoutAmount,
      flaggedEvents,
      platformFee: totalRevenue * 0.1
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
