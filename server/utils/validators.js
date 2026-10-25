// A MongoDB ObjectId is 24 hex characters. Plain JS, no mongoose needed.
const isObjectIdString = (v) => typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v);

module.exports = { isObjectIdString };
