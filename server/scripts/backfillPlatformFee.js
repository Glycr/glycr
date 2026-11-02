// scripts/backfillPlatformFee.js
//
// One-time script. Tickets bought before fees were recorded have no
// `platformFee`, so they are priced at TODAY's percentage every time they are
// read. This writes the fee onto each of them once, at the percentage that is
// currently configured, so a later settings change can no longer reprice them.
//
// Every old ticket was sold under "the organizer pays", so:
//   platformFee = price × current percentage
//   feePaidBy   = 'organizer'
//   amountPaid  = price            (buyers only ever paid the ticket price)
//
// Safe to run more than once: it only touches tickets that have no fee yet.
//
//   node scripts/backfillPlatformFee.js --dry    count what would change
//   node scripts/backfillPlatformFee.js          write the changes
//
// Needs MongoDB 4.2 or newer (uses an update pipeline and $round).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const config = require('../config');
const Ticket = require('../models/Ticket');
const settingsService = require('../services/settingsService');
const { REVENUE } = require('../services/revenueService');

(async () => {
  const dry = process.argv.includes('--dry');

  // use whichever connection setting your project already has
  const uri = process.env.MONGODB_URI || config.mongoUri || config.mongoURI || config.dbUri;
  if (!uri) throw new Error('No MongoDB connection string found (set MONGODB_URI)');
  await mongoose.connect(uri);

  const settings = await settingsService.getSettings();
  const rate = (Number(settings.platformFee) || 0) / 100;
  const filter = { platformFee: null };    // matches missing and null

  const count = await Ticket.countDocuments(filter);
  console.log(`${count} ticket(s) without a stored fee. Rate that will be applied: ${settings.platformFee}%`);

  if (dry) {
    console.log('Dry run: nothing was changed.');
  } else if (count > 0) {
    const res = await Ticket.updateMany(filter, [{
      $set: {
        platformFee: { $round: [{ $multiply: [REVENUE, rate] }, 2] },
        feePaidBy: 'organizer',
        amountPaid: { $round: [REVENUE, 2] },
      },
    }],
      { updatePipeline: true }   // 👈 required by newer Mongoose
    );
    console.log(`Updated ${res.modifiedCount} ticket(s).`);
  }

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
