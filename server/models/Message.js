const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },        // e.g. msg_1735123456789 or bcast_...
  type: { type: String, enum: ['direct', 'broadcast'], required: true },
  audience: { type: String },   // 'all_users', 'organizers', 'customers', 'both', or 'individual' for direct
  subject: { type: String, required: true },
  body: { type: String, required: true },
  channel: { type: String, enum: ['email', 'sms', 'both'], required: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },  // for direct messages
  recipientName: { type: String },
  recipientEmail: { type: String },
  recipientCount: { type: Number, default: 1 },
  sentBy: { type: String, required: true },   // admin name
  sentAt: { type: Date, default: Date.now },
});

messageSchema.set('toJSON', { virtuals: true });
module.exports = mongoose.model('Message', messageSchema);
