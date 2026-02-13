const { db } = require('../config/firebase');
const { COLLECTIONS, LIMITS } = require('../config/constants');
const { generateApiKey, generateUserId, getCurrentISOString, getCurrentDateString } = require('../utils/helpers');

class APIKeyService {
  async createAPIKey(email, phoneNumber, projectName) {
    const api_key = generateApiKey();
    const user_id = generateUserId();
    const now = getCurrentISOString();
    const start_date = getCurrentDateString();

    const docRef = await db.collection(COLLECTIONS.API_KEYS).add({
      api_key,
      email,
      phone_number: phoneNumber,
      project_name: projectName,
      user_id,
      is_active: true,
      start_date,
      created_at: now,
      updated_at: now,
      limit: 0,
      error_count: 0
    });

    return {
      api_key,
      user_id,
      docId: docRef.id,
      start_date
    };
  }

  async checkExistingEmail(email) {
    const snap = await db
      .collection(COLLECTIONS.API_KEYS)
      .where('email', '==', email)
      .limit(1)
      .get();

    return !snap.empty;
  }

  async checkExistingPhone(phoneNumber) {
    const snap = await db
      .collection(COLLECTIONS.API_KEYS)
      .where('phone_number', '==', phoneNumber)
      .limit(1)
      .get();

    return !snap.empty;
  }

  async updateMaliciousAttempt(docRef, currentErrorCount) {
    const newErrorCount = currentErrorCount + 1;
    const now = getCurrentISOString();

    const updateData = {
      error_count: newErrorCount,
      last_malicious_attempt: now,
      last_requested_stamp: now
    };

    if (newErrorCount >= LIMITS.MALICIOUS_ATTEMPTS_BAN) {
      updateData.is_active = false;
      updateData.ban_reason = 'Malicious messages detected';
      updateData.ban_date = now;
      
      await docRef.update(updateData);
      
      return {
        banned: true,
        error_count: newErrorCount,
        ban_date: now
      };
    } else {
      await docRef.update(updateData);
      
      return {
        banned: false,
        error_count: newErrorCount,
        attempts_remaining: LIMITS.MALICIOUS_ATTEMPTS_BAN - newErrorCount
      };
    }
  }

  async resetErrorCount(docRef) {
    await docRef.update({
      error_count: 0,
      last_malicious_attempt: null
    });
  }

  async incrementUsage(docRef, currentLimit) {
    await docRef.update({
      updated_at: getCurrentISOString(),
      limit: currentLimit + 1,
      last_requested_stamp: getCurrentISOString()
    });
  }

  async updateLastRequestStamp(docRef) {
    await docRef.update({
      last_requested_stamp: getCurrentISOString()
    });
  }
}

module.exports = new APIKeyService();