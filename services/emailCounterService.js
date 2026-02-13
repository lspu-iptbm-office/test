const { db } = require('../config/firebase');
const { COLLECTIONS, LIMITS } = require('../config/constants');

class EmailCounterService {
  constructor() {
    this.counterDocId = 'daily_email_counter';
    this.collection = COLLECTIONS.EMAIL_COUNTERS;
  }

  getTodayDate() {
    return new Date().toISOString().split('T')[0];
  }

  async getTodayCounter() {
    const today = this.getTodayDate();
    const counterRef = db.collection(this.collection).doc(this.counterDocId);
    
    const counterDoc = await counterRef.get();
    
    if (!counterDoc.exists) {
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

  async incrementEmailCounter() {
    const today = this.getTodayDate();
    const counterRef = db.collection(this.collection).doc(this.counterDocId);
    
    return await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      if (!counterDoc.exists) {
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
      
      if (data.date !== today) {
        transaction.update(counterRef, {
          date: today,
          count: 1,
          last_reset: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        return 1;
      }
      
      const newCount = (data.count || 0) + 1;
      transaction.update(counterRef, {
        count: newCount,
        updated_at: new Date().toISOString()
      });
      
      return newCount;
    });
  }

  async isEmailLimitReached() {
    const { count } = await this.getTodayCounter();
    return count >= LIMITS.EMAIL_DAILY_LIMIT;
  }

  async getRemainingEmails() {
    const { count } = await this.getTodayCounter();
    const remaining = LIMITS.EMAIL_DAILY_LIMIT - count;
    return remaining > 0 ? remaining : 0;
  }

  async getEmailUsageStats() {
    const { count, date } = await this.getTodayCounter();
    return {
      date,
      sent_today: count,
      daily_limit: LIMITS.EMAIL_DAILY_LIMIT,
      remaining: LIMITS.EMAIL_DAILY_LIMIT - count,
      percentage_used: ((count / LIMITS.EMAIL_DAILY_LIMIT) * 100).toFixed(2),
      is_exhausted: count >= LIMITS.EMAIL_DAILY_LIMIT
    };
  }
}

module.exports = new EmailCounterService();