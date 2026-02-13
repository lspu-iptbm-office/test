const { db } = require('../config/firebase');
const { LIMITS } = require('../config/constants');
const { calculateWaitTime } = require('../utils/helpers');

const checkDailyLimit = async (req, res, next) => {
  try {
    const tokenDoc = req.apiKey.data;
    const currentLimit = tokenDoc.limit || 0;

    if (currentLimit >= LIMITS.DAILY_SMS_LIMIT) {
      return res.status(403).json({
        success: false,
        error: `Message limit reached (${LIMITS.DAILY_SMS_LIMIT}/${LIMITS.DAILY_SMS_LIMIT})`,
        details: 'This API has a temporary limit of 50 messages per day. We will return to no limit when the volume goes down.',
        current_usage: currentLimit,
        max_allowed: LIMITS.DAILY_SMS_LIMIT
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

const checkRateLimit = async (req, res, next) => {
  try {
    const tokenDoc = req.apiKey.data;
    const lastSent = tokenDoc.updated_at;
    
    const waitTime = calculateWaitTime(lastSent, 10000); // 10 seconds
    
    if (waitTime > 0) {
      return res.status(429).json({
        success: false,
        error: `Rate limit exceeded. Try again in ${waitTime} second(s).`
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { checkDailyLimit, checkRateLimit };