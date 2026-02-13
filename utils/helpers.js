const crypto = require('crypto');
const { LIMITS } = require('../config/constants');

const generateApiKey = () => {
  return LIMITS.API_KEY_PREFIX + crypto.randomBytes(12).toString('hex');
};

const generateUserId = () => {
  return crypto.randomBytes(10).toString('hex');
};

const getCurrentISOString = () => {
  return new Date().toISOString();
};

const getCurrentDateString = () => {
  return getCurrentISOString().split('T')[0];
};

const calculateWaitTime = (lastSent, intervalMs = 10000) => {
  const now = new Date();
  const last = lastSent ? new Date(lastSent) : null;
  
  if (!last) return 0;
  
  const timeDiff = now - last;
  return timeDiff < intervalMs ? Math.ceil((intervalMs - timeDiff) / 1000) : 0;
};

module.exports = {
  generateApiKey,
  generateUserId,
  getCurrentISOString,
  getCurrentDateString,
  calculateWaitTime
};