const Message = require('../models/Message');
const User = require('../models/User');
const { sendEmail, sendSMS } = require('./notificationService');

class MessageService {
  async createDirectMessage(recipientId, subject, body, channel, sentBy) {
    const recipient = await User.findById(recipientId);
    if (!recipient) throw new Error('Recipient not found');

    const msgId = `msg_${Date.now()}`;
    const message = new Message({
      id: msgId,
      type: 'direct',
      audience: 'individual',
      subject,
      body,
      channel,
      recipientId: recipient._id,
      recipientName: recipient.name,
      recipientEmail: recipient.email,
      recipientCount: 1,
      sentBy,
    });
    await message.save();

    // Actually send based on channel
    if (channel === 'email' || channel === 'both') {
      await sendEmail(recipient.email, subject, `<pre>${body}</pre>`, body);
    }
    if (channel === 'sms' || channel === 'both') {
      if (recipient.phone) await sendSMS(recipient.phone, body);
    }
    return message;
  }

  async createBroadcast(audience, subject, body, channel, sentBy) {
    let query = {};
    if (audience === 'organizers') query = { role: 'organizer' };
    else if (audience === 'customers') query = { role: 'customer' };
    else if (audience === 'both') query = { role: { $in: ['customer', 'organizer'] } };
    // 'all_users' → no filter

    const recipients = await User.find(query).select('email phone name');
    const count = recipients.length;

    const msgId = `bcast_${Date.now()}`;
    const message = new Message({
      id: msgId,
      type: 'broadcast',
      audience,
      subject,
      body,
      channel,
      recipientCount: count,
      sentBy,
    });
    await message.save();

    // Send asynchronously (fire and forget, but catch errors)
    for (const user of recipients) {
      if (channel === 'email' || channel === 'both') {
        sendEmail(user.email, subject, `<pre>${body}</pre>`, body).catch(e => console.error(e));
      }
      if (channel === 'sms' || channel === 'both') {
        if (user.phone) sendSMS(user.phone, body).catch(e => console.error(e));
      }
    }
    return message;
  }

  async getAllMessages() {
    const messages = await Message.find().sort({ sentAt: -1 }).lean();
    return { messages };
  }

  async deleteMessage(messageId) {
    const msg = await Message.findOne({ id: messageId });
    if (!msg) throw new Error('Message not found');
    await msg.deleteOne();
    return true;
  }
}

module.exports = new MessageService();
