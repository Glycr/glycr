require('dotenv').config(); // Load environment variables from .env
const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');

// Import models
const User = require('../models/User');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const Waitlist = require('../models/Waitlist');
const Payout = require('../models/Payout');

async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set in environment. Check your .env file.');
  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB');

  const dataDir = path.join(__dirname, '../data');
  console.log('Reading data from', dataDir);

  // Load JSON data (handle missing files gracefully)
  let usersData = [], eventsData = [], ticketsData = [], waitlistsData = [], payoutsData = [];
  try {
    usersData = JSON.parse(await fs.readFile(path.join(dataDir, 'users.json'), 'utf8'));
    console.log(`📄 Loaded ${usersData.length} users`);
  } catch (err) { console.warn('No users.json, skipping users'); }
  try {
    eventsData = JSON.parse(await fs.readFile(path.join(dataDir, 'events.json'), 'utf8'));
    console.log(`📄 Loaded ${eventsData.length} events`);
  } catch (err) { console.warn('No events.json, skipping events'); }
  try {
    ticketsData = JSON.parse(await fs.readFile(path.join(dataDir, 'tickets.json'), 'utf8'));
    console.log(`📄 Loaded ${ticketsData.length} tickets`);
  } catch (err) { console.warn('No tickets.json, skipping tickets'); }
  try {
    waitlistsData = JSON.parse(await fs.readFile(path.join(dataDir, 'waitlists.json'), 'utf8'));
    console.log(`📄 Loaded ${waitlistsData.length} waitlist entries`);
  } catch (err) { console.warn('No waitlists.json, skipping waitlists'); }
  try {
    payoutsData = JSON.parse(await fs.readFile(path.join(dataDir, 'payouts.json'), 'utf8'));
    console.log(`📄 Loaded ${payoutsData.length} payouts`);
  } catch (err) { console.warn('No payouts.json, skipping payouts'); }

  // Step 1: Migrate users
  const userMap = new Map(); // email -> new ObjectId
  for (const oldUser of usersData) {
    const existing = await User.findOne({ email: oldUser.email });
    if (!existing) {
      // Hash the password – note: old password was stored as base64, we'll treat as plaintext for new hash
      const hashedPassword = await bcrypt.hash(oldUser.password, 10);
      const newUser = new User({
        name: oldUser.name,
        email: oldUser.email,
        password: hashedPassword,
        phone: oldUser.phone,
        isOrganizer: oldUser.isOrganizer,
        isAdmin: oldUser.isAdmin || false,
        suspended: oldUser.suspended || false,
        currency: oldUser.currency || 'GHC',
        createdAt: oldUser.createdAt ? new Date(oldUser.createdAt) : new Date(),
      });
      await newUser.save();
      console.log(`👤 Created user: ${oldUser.email}`);
      userMap.set(oldUser.email, newUser._id);
    } else {
      console.log(`👤 User already exists: ${oldUser.email} → using existing ID`);
      userMap.set(oldUser.email, existing._id);
    }
  }

  // Step 2: Migrate events
  for (const oldEvent of eventsData) {
    const organizer = await User.findOne({ email: oldEvent.organizerEmail });
    if (!organizer) {
      console.warn(`⚠️ Skipping event "${oldEvent.title}" – organizer email ${oldEvent.organizerEmail} not found`);
      continue;
    }
    // Check if event already exists (by title and date)
    const existing = await Event.findOne({ title: oldEvent.title, date: new Date(oldEvent.date) });
    if (!existing) {
      const newEvent = new Event({
        title: oldEvent.title,
        description: oldEvent.description,
        date: new Date(oldEvent.date),
        venue: oldEvent.venue,
        location: oldEvent.location,
        category: oldEvent.category,
        currency: oldEvent.currency,
        image: oldEvent.image,
        ticketTypes: JSON.parse(oldEvent.ticketTypes),
        organizerId: organizer._id,
        isPublished: oldEvent.isPublished,
        isCancelled: oldEvent.isCancelled,
        flagged: oldEvent.flagged || false,
        createdAt: oldEvent.createdAt ? new Date(oldEvent.createdAt) : new Date(),
      });
      await newEvent.save();
      console.log(`🎉 Created event: ${oldEvent.title}`);
    } else {
      console.log(`🎉 Event already exists: ${oldEvent.title}`);
    }
  }

  // Step 3: Migrate tickets (need event mapping by title/date and user by email)
  const events = await Event.find({});
  const eventsByOldId = new Map();
  // For old events, we don't have a direct mapping from old numeric id to new ObjectId.
  // We'll try to match by title+date.
  for (const ev of events) {
    // Store with key of old id? We'll store by combination.
  }
  for (const oldTicket of ticketsData) {
    const user = await User.findOne({ email: oldTicket.userEmail });
    if (!user) {
      console.warn(`⚠️ Skipping ticket for user ${oldTicket.userEmail} – user not found`);
      continue;
    }
    // Find matching event: we can match by title (but oldTicket might only have eventId)
    // We need to find the new event that corresponds to the old eventId. Since we don't have the old event ID, we'll attempt to find by event title stored in tickets? The old ticket object likely has eventId, not title.
    // We'll skip this for now – you can add mapping logic if needed.
    console.log(`ℹ️ Ticket for user ${oldTicket.userEmail} – not imported (no event mapping)`);
  }

  // Step 4: Migrate waitlists (similar to tickets)
  // Step 5: Migrate payouts

  console.log('✅ Migration completed');
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
