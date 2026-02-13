const { db, FieldValue } = require('../config/firebase');
const { COLLECTIONS, LIMITS } = require('../config/constants');

class GlobalCounterService {
  constructor() {
    this.counterDocId = 'daily_sms_counter';
    this.collection = COLLECTIONS.GLOBAL_COUNTERS;
  }

  // Get today's date in YYYY-MM-DD format
  getTodayDate() {
    return new Date().toISOString().split('T')[0];
  }

  // Initialize or get today's counter
  async getTodayCounter() {
    const today = this.getTodayDate();
    const counterRef = db.collection(this.collection).doc(this.counterDocId);
    
    const counterDoc = await counterRef.get();
    
    if (!counterDoc.exists) {
      // Create initial counter
      await counterRef.set({
        date: today,
        count: 0,
        last_reset: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      return { count: 0, date: today };
    }
    
    const data = counterDoc.data();
    
    // Check if date changed, reset counter
    if (data.date !== today) {
      await counterRef.update({
        date: today,
        count: 0,
        last_reset: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      return { count: 0, date: today };
    }
    
    return { count: data.count || 0, date: data.date };
  }

  // Increment global counter
  async incrementGlobalCounter() {
    const today = this.getTodayDate();
    const counterRef = db.collection(this.collection).doc(this.counterDocId);
    
    // Use transaction to ensure atomic increment
    return await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      if (!counterDoc.exists) {
        // Create new counter with count 1
        transaction.set(counterRef, {
          date: today,
          count: 1,
          last_reset: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        return 1;
      }
      
      const data = counterDoc.data();
      
      // Reset if new day
      if (data.date !== today) {
        transaction.update(counterRef, {
          date: today,
          count: 1,
          last_reset: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        return 1;
      }
      
      // Increment existing counter
      const newCount = (data.count || 0) + 1;
      transaction.update(counterRef, {
        count: newCount,
        updated_at: new Date().toISOString()
      });
      
      return newCount;
    });
  }

  // Check if global limit is reached
  async isGlobalLimitReached() {
    const { count } = await this.getTodayCounter();
    return count >= LIMITS.GLOBAL_DAILY_SMS_LIMIT;
  }

  // Get remaining global SMS
  async getRemainingGlobalSMS() {
    const { count } = await this.getTodayCounter();
    const remaining = LIMITS.GLOBAL_DAILY_SMS_LIMIT - count;
    return remaining > 0 ? remaining : 0;
  }

  // Get global usage stats
  async getGlobalUsageStats() {
    const { count, date } = await this.getTodayCounter();
    
    return {
      date,
      sent_today: count,
      daily_limit: LIMITS.GLOBAL_DAILY_SMS_LIMIT,
      remaining: LIMITS.GLOBAL_DAILY_SMS_LIMIT - count,
      percentage_used: ((count / LIMITS.GLOBAL_DAILY_SMS_LIMIT) * 100).toFixed(2)
    };
  }

  // Decrement counter (for failed SMS or rollback)
  async decrementGlobalCounter() {
    const today = this.getTodayDate();
    const counterRef = db.collection(this.collection).doc(this.counterDocId);
    
    return await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      if (!counterDoc.exists) {
        return 0;
      }
      
      const data = counterDoc.data();
      
      // Only decrement if same day and count > 0
      if (data.date === today && data.count > 0) {
        const newCount = data.count - 1;
        transaction.update(counterRef, {
          count: newCount,
          updated_at: new Date().toISOString()
        });
        return newCount;
      }
      
      return data.count || 0;
    });
  }

  // Reset counter manually (admin function)
  async resetCounter() {
    const today = this.getTodayDate();
    const counterRef = db.collection(this.collection).doc(this.counterDocId);
    
    await counterRef.set({
      date: today,
      count: 0,
      last_reset: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { merge: true });
    
    return { success: true, date: today, count: 0 };
  }
}

module.exports = new GlobalCounterService();