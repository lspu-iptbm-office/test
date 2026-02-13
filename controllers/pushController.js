const pushService = require('../services/pushService');
const { STATUS } = require('../config/constants');

class PushController {
  // Get VAPID public key
  getVapidPublicKey(req, res) {
    res.json({
      success: true,
      publicKey: pushService.getVapidPublicKey()
    });
  }

  // Subscribe to push notifications
  async subscribe(req, res) {
    try {
      const { userId, subscription } = req.body;
      const apiKey = req.apiKey.key; // From auth middleware
      
      if (!userId || !subscription || !subscription.endpoint) {
        return res.status(STATUS.BAD_REQUEST).json({
          success: false,
          error: 'userId and subscription are required'
        });
      }

      const result = await pushService.saveSubscription(
        userId,
        apiKey,
        subscription
      );

      if (result.success) {
        res.status(STATUS.CREATED).json({
          success: true,
          message: 'Successfully subscribed to push notifications',
          subscription_id: result.id
        });
      } else {
        res.status(STATUS.SERVER_ERROR).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      res.status(STATUS.SERVER_ERROR).json({
        success: false,
        error: error.message
      });
    }
  }

  // Unsubscribe from push notifications
  async unsubscribe(req, res) {
    try {
      const { endpoint } = req.body;
      
      if (!endpoint) {
        return res.status(STATUS.BAD_REQUEST).json({
          success: false,
          error: 'endpoint is required'
        });
      }

      const result = await pushService.removeSubscription(endpoint);

      if (result.success) {
        res.json({
          success: true,
          message: 'Successfully unsubscribed from push notifications'
        });
      } else {
        res.status(STATUS.NOT_FOUND).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      res.status(STATUS.SERVER_ERROR).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get push status for user
  async getPushStatus(req, res) {
    try {
      const userId = req.query.userId || req.apiKey.data.user_id;
      const stats = await pushService.getUserPushStats(userId);
      const hasCapability = await pushService.hasPushCapability(userId);

      res.json({
        success: true,
        userId,
        is_available: hasCapability,
        ...stats
      });
    } catch (error) {
      res.status(STATUS.SERVER_ERROR).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new PushController();