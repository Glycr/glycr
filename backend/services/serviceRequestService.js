const ServiceRequest = require('../models/ServiceRequest');
const { sendEmail } = require('./notificationService');

class ServiceRequestService {
  async createRequest(userId, userName, userEmail, category, subject, message) {
    const now = new Date();
    const year  = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day   = String(now.getDate()).padStart(2, '0');

    // Fix: use separate Date objects to avoid mutation
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // Fix: count by submittedAt (not createdAt — field doesn't exist in schema)
    const countToday = await ServiceRequest.countDocuments({
      submittedAt: { $gte: startOfDay, $lte: endOfDay }
    });

    const position  = String(countToday + 1).padStart(2, '0');
    const requestId = `SR-${position}${day}${month}${year}`;

    const request = new ServiceRequest({
      requestId,
      userId,
      userName,
      userEmail,
      category,
      subject,
      message,
      status: 'pending',
    });

    await request.save();
    return request;
  }
  async getAllRequests() {
    return ServiceRequest.find().sort({ submittedAt: -1 }).lean();
  }

  async updateStatus(requestId, status, resolutionNotes = null) {
    const request = await ServiceRequest.findById(requestId);
    if (!request) throw new Error('Service request not found');
    request.status = status;
    if (status === 'resolved') {
      request.resolvedAt = new Date();
      if (resolutionNotes) request.resolutionNotes = resolutionNotes;
    }
    await request.save();

    if (status === 'resolved' && resolutionNotes) {
      await sendEmail(
        request.userEmail,
        `Your support request has been resolved: ${request.subject}`,
        `<p>Your request has been marked as resolved.</p>
         <p><strong>Resolution notes:</strong><br>${resolutionNotes}</p>
         <p>If you have further questions, please reply to this email.</p>`
      );
    }
    return request;
  }

  async resolveRequest(requestId, resolutionNotes) {
    return this.updateStatus(requestId, 'resolved', resolutionNotes);
  }

  async markInProgress(requestId) {
    return this.updateStatus(requestId, 'in_progress');
  }
}

module.exports = new ServiceRequestService();
