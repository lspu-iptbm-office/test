const webpush = require('web-push');
const { db } = require('../config/firebase');
const { WEB_PUSH, COLLECTIONS } = require('../config/constants');

class PushService {
  constructor() {
    // Initialize web-push with VAPID keys
    webpush.setVapidDetails(
      WEB_PUSH.VAPID_SUBJECT,
      WEB_PUSH.VAPID_PUBLIC_KEY,
      WEB_PUSH.VAPID_PRIVATE_KEY
    );
  }

  // Get VAPID public key for frontend
  getVapidPublicKey() {
    return WEB_PUSH.VAPID_PUBLIC_KEY;
  }

  // Save subscription to database
  async saveSubscription(userId, apiKey, subscription) {
    try {
      // Check if subscription already exists
      const existing = await db
        .collection(COLLECTIONS.PUSH_SUBSCRIPTIONS)
        .where('endpoint', '==', subscription.endpoint)
        .limit(1)
        .get();

      if (!existing.empty) {
        // Update existing
        const docRef = existing.docs[0].ref;
        await docRef.update({
          userId,
          apiKey,
          subscription,
          updated_at: new Date().toISOString()
        });
        return { success: true, id: docRef.id };
      }

      // Create new
      const docRef = await db.collection(COLLECTIONS.PUSH_SUBSCRIPTIONS).add({
        userId,
        apiKey,
        subscription,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_agent: subscription.user_agent || 'unknown',
        is_active: true,
        failure_count: 0
      });

      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('Save subscription error:', error);
      return { success: false, error: error.message };
    }
  }

  // Remove subscription
  async removeSubscription(endpoint) {
    try {
      const snapshot = await db
        .collection(COLLECTIONS.PUSH_SUBSCRIPTIONS)
        .where('endpoint', '==', endpoint)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        await snapshot.docs[0].ref.delete();
        return { success: true };
      }

      return { success: false, error: 'Subscription not found' };
    } catch (error) {
      console.error('Remove subscription error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get user's active subscriptions
  async getUserSubscriptions(userId) {
    try {
      const snapshot = await db
        .collection(COLLECTIONS.PUSH_SUBSCRIPTIONS)
        .where('userId', '==', userId)
        .where('is_active', '==', true)
        .get();

      const subscriptions = [];
      snapshot.forEach(doc => {
        subscriptions.push({
          id: doc.id,
          ...doc.data().subscription
        });
      });

      return subscriptions;
    } catch (error) {
      console.error('Get subscriptions error:', error);
      return [];
    }
  }

  // Send push notification to specific user
  async sendNotificationToUser(userId, title, body, data = {}) {
    try {
      const subscriptions = await this.getUserSubscriptions(userId);
      
      if (subscriptions.length === 0) {
        return {
          success: false,
          error: 'No active push subscriptions found',
          sent: 0,
          total: 0
        };
      }

      const payload = JSON.stringify({
        title,
        body,
        icon: '/icon.png',
        badge: '/badge.png',
        vibrate: [200, 100, 200],
        data: {
          url: data.url || '/',
          timestamp: Date.now(),
          ...data
        }
      });

      const results = {
        success: true,
        sent: 0,
        failed: 0,
        total: subscriptions.length,
        errors: []
      };

      // Send to all user's devices
      for (const subscription of subscriptions) {
        try {
          await webpush.sendNotification(subscription, payload, {
            TTL: WEB_PUSH.TTL
          });
          results.sent++;
          
          // Log successful notification
          await this.logNotification(userId, subscription.endpoint, title, body, 'sent');
          
        } catch (error) {
          results.failed++;
          results.errors.push({
            endpoint: subscription.endpoint.substring(0, 50) + '...',
            error: error.message
          });

          // If expired or invalid, mark as inactive
          if (error.statusCode === 410) {
            await this.markSubscriptionInactive(subscription.endpoint);
          }

          // Log failed notification
          await this.logNotification(userId, subscription.endpoint, title, body, 'failed', error.message);
        }
      }

      return results;

    } catch (error) {
      console.error('Send push notification error:', error);
      return {
        success: false,
        error: error.message,
        sent: 0,
        total: 0
      };
    }
  }

  // Mark subscription as inactive
  async markSubscriptionInactive(endpoint) {
    try {
      const snapshot = await db
        .collection(COLLECTIONS.PUSH_SUBSCRIPTIONS)
        .where('endpoint', '==', endpoint)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        await snapshot.docs[0].ref.update({
          is_active: false,
          deactivated_at: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Mark subscription inactive error:', error);
    }
  }

  // Log notification
  async logNotification(userId, endpoint, title, body, status, error = null) {
    try {
      await db.collection(COLLECTIONS.PUSH_NOTIFICATIONS).add({
        userId,
        endpoint: endpoint.substring(0, 100), // Trim for storage
        title,
        body: body.substring(0, 200),
        status,
        error,
        sent_at: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error('Log notification error:', error);
    }
  }

  // Check if user has push capability
  async hasPushCapability(userId) {
    const subscriptions = await this.getUserSubscriptions(userId);
    return subscriptions.length > 0;
  }

  // Get push statistics for user
  async getUserPushStats(userId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const notifications = await db
        .collection(COLLECTIONS.PUSH_NOTIFICATIONS)
        .where('userId', '==', userId)
        .where('date', '==', today)
        .get();

      let sent = 0, failed = 0;
      notifications.forEach(doc => {
        const data = doc.data();
        if (data.status === 'sent') sent++;
        else if (data.status === 'failed') failed++;
      });

      return {
        has_subscription: (await this.getUserSubscriptions(userId)).length > 0,
        sent_today: sent,
        failed_today: failed,
        total_today: sent + failed
      };
    } catch (error) {
      console.error('Get push stats error:', error);
      return {
        has_subscription: false,
        sent_today: 0,
        failed_today: 0,
        total_today: 0
      };
    }
  }
}

module.exports = new PushService();