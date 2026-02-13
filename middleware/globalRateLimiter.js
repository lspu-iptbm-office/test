const globalCounterService = require('../services/globalCounterService');
const emailService = require('../services/emailService');
const pushService = require('../services/pushService');
const { LIMITS } = require('../config/constants');
const { STATUS } = require('../config/constants');

const checkGlobalDailyLimit = async (req, res, next) => {
  try {
    const isReached = await globalCounterService.isGlobalLimitReached();
    const stats = await globalCounterService.getGlobalUsageStats();
    const { recipient, message } = req.body;
    
    if (isReached) {
      // Get API key details from request (na-set na ng authenticateApiKey)
      const apiKeyData = req.apiKey?.data;
      
      // If may API key details, send email fallback
      if (apiKeyData && apiKeyData.email) {
        
        console.log(`📧 SMS limit reached - Sending email fallback to ${apiKeyData.email}`);
        
        // Send email instead of SMS
        const emailResult = await emailService.sendSMSFallback(
          apiKeyData.email,
          `Original recipient: ${recipient}\n\n${message}`,
          apiKeyData.project_name || 'SMS API'
        );
        
        if (emailResult.success) {
          // Log the email fallback
          console.log(`✅ Email fallback sent to ${apiKeyData.email}`);
          
          return res.status(STATUS.SUCCESS).json({
            success: true,
            message: 'System capacity has been reached. Message sent via email instead.',
            email_recipient: apiKeyData.email,
            delivery_method: 'email_fallback'
          });
        }
      }

      console.log(`🔔 SMS & Email limits - Trying PUSH notification for user ${apiKeyData.user_id}`);
      const pushResult = await pushService.sendNotificationToUser(
        apiKeyData.user_id,
        `Message from ${apiKeyData.project_name}`,
        message.length > 100 ? message.substring(0, 100) + '...' : message,
        {
          url: 'https://sms-api-ph.netlify.app',
          recipient: recipient,
          timestamp: new Date().toISOString()
        }
      );

      if (pushResult.success && pushResult.sent > 0) {
        return res.status(STATUS.SUCCESS).json({
          success: true,
          message: 'System capacity limit reached. Message sent via WEB PUSH',
          delivery_method: 'web_push',
          details: 'Notification sent to your browser',
        });
      }
      
      // If walang email or failed ang email, saka mag-error
      return res.status(STATUS.TOO_MANY_REQUESTS).json({
        success: false,
        error: 'System capacity limit reached. Please try again tomorrow.'
      });
    }

    // Attach global stats to request for logging
    req.globalSmsStats = stats;
    next();
    
  } catch (error) {
    console.error('Global rate limiter error:', error);
    // Fail open - allow SMS if counter fails
    console.warn('Global counter failed, allowing SMS anyway');
    next();
  }
};

module.exports = { checkGlobalDailyLimit };