// ============================================
// FILE: utils/helpers.js
// ============================================
const crypto = require('crypto');

const generateTicketId = () => {
  return `GLY-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
};

const calculatePrice = (ticketTypeData, quantity) => {
  let price = ticketTypeData.price;

  // Check early bird
  if (ticketTypeData.earlyBirdEnd && new Date() < new Date(ticketTypeData.earlyBirdEnd)) {
    price = ticketTypeData.earlyBirdPrice || price;
  }

  // Apply group discount
  if (quantity >= 10) {
    price = price * (1 - (ticketTypeData.groupDiscount * 2) / 100);
  } else if (quantity >= 5) {
    price = price * (1 - ticketTypeData.groupDiscount / 100);
  }

  return price;
};

module.exports = { generateTicketId, calculatePrice };
