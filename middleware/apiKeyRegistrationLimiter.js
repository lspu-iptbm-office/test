// middlewares/apiKeyRegistrationLimiter.js
const admin = require('firebase-admin');
const { LIMITS, COLLECTIONS, STATUS } = require('../config/constants');

const REGISTRATION_LIMITS = {
  DAILY_MAX: LIMITS.API_KEY_REGISTRATION_DAILY_LIMIT,
  COUNTER_ID: 'api_key_registration_counter'
};

const apiKeyRegistrationLimiter = async (req, res, next) => {
  try {
    const db = admin.firestore();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Use SYSTEM_COUNTERS collection from constants
    const counterRef = db.collection(COLLECTIONS.SYSTEM_COUNTERS).doc(REGISTRATION_LIMITS.COUNTER_ID);
    
    // Run transaction to safely increment and check limit
    await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      let currentCount = 0;
      let currentDate = today;
      
      if (counterDoc.exists) {
        const data = counterDoc.data();
        currentDate = data.date || today;
        currentCount = data.count || 0;
        
        // Reset if new day
        if (currentDate !== today) {
          currentCount = 0;
          currentDate = today;
        }
      }
      
      // Check if limit reached
      if (currentCount >= REGISTRATION_LIMITS.DAILY_MAX) {
        throw new Error('REGISTRATION_LIMIT_REACHED');
      }
      
      // Increment count for this registration
      transaction.set(counterRef, {
        count: currentCount + 1,
        date: currentDate,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        ...(counterDoc.exists ? {} : { created_at: admin.firestore.FieldValue.serverTimestamp() })
      }, { merge: true });
      
      // Attach stats to request
      req.registrationStats = {
        current: currentCount + 1,
        limit: REGISTRATION_LIMITS.DAILY_MAX,
        remaining: REGISTRATION_LIMITS.DAILY_MAX - (currentCount + 1),
        date: currentDate
      };
    });
    
    // Log remaining slots
    console.log(`📝 API Key registration stats: ${req.registrationStats.remaining}/${req.registrationStats.limit} slots remaining today`);
    
    next();
    
  } catch (error) {
    if (error.message === 'REGISTRATION_LIMIT_REACHED') {
      return res.status(STATUS.TOO_MANY_REQUESTS).json({
        success: false,
        error: 'Registration limit reached for today. Please try again tomorrow.',
        limit: REGISTRATION_LIMITS.DAILY_MAX,
        reset_date: new Date().toISOString().split('T')[0]
      });
    }
    
    console.error('API Key registration limiter error:', error);
    
    // Fail open - allow registration if counter fails
    console.warn('⚠️ Registration counter failed, allowing registration anyway');
    next();
  }
};

module.exports = apiKeyRegistrationLimiter;