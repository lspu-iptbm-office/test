const { STATUS, LIMITS, COLLECTIONS } = require('../config/constants');
const { normalizePHNumber, validateMessage } = require('../utils/validators');
const { getCurrentISOString } = require('../utils/helpers');
const smsGateway = require('../services/smsGateway');
const aiDetection = require('../services/aiDetection');
const apiKeyService = require('../services/apiKeyService');
const globalCounterService = require('../services/globalCounterService');
const queueManager = require('../middleware/queueManager');
const { db } = require('../config/firebase');

class SMSController {
  async sendSMS(req, res) {
    try {
      const { recipient, message } = req.body;
      const { docRef: tokenDocRef, data: tokenDoc, key: authHeader } = req.apiKey;

      // Check global limit FIRST
      const isGlobalLimitReached = await globalCounterService.isGlobalLimitReached();
      const globalStats = await globalCounterService.getGlobalUsageStats();
      
      if (isGlobalLimitReached) {
        return res.status(STATUS.TOO_MANY_REQUESTS).json({
          success: false,
          error: 'Global daily SMS limit reached',
          details: `System capacity limit reached. Please try again tomorrow.`,
          global_usage: {
            sent_today: globalStats.sent_today,
            daily_limit: globalStats.daily_limit,
            remaining: globalStats.remaining,
            reset_date: globalStats.date
          }
        });
      }

      // Validate recipient
      if (!recipient) {
        return res.status(STATUS.BAD_REQUEST).json({
          success: false,
          error: 'recipient is required'
        });
      }

      const normalizedRecipient = normalizePHNumber(recipient);
      if (!normalizedRecipient) {
        return res.status(STATUS.BAD_REQUEST).json({
          success: false,
          error: 'Invalid Philippine phone number format'
        });
      }

      // Validate message
      const messageValidation = validateMessage(message);
      if (!messageValidation.isValid) {
        return res.status(STATUS.BAD_REQUEST).json({
          success: false,
          error: messageValidation.errors[0]
        });
      }

      // Check malicious content
      const isMalicious = await aiDetection.detectMaliciousMessage(message);
      const maliciousObj = aiDetection.parseMaliciousResponse(isMalicious);

      if (maliciousObj && maliciousObj.malicious === "true") {
        return await this.handleMaliciousMessage(
          req, res, 
          tokenDocRef, 
          tokenDoc, 
          authHeader, 
          message
        );
      }

      // Reset error count if needed
      if (tokenDoc.error_count > 0) {
        await apiKeyService.resetErrorCount(tokenDocRef);
      }

      // Update last request stamp
      await apiKeyService.updateLastRequestStamp(tokenDocRef);

      // Prepare SMS data for queue
      const smsData = {
        recipient: normalizedRecipient,
        message,
        tokenDoc,
        tokenDocRef,
        currentLimit: tokenDoc.limit || 0
      };

      // Process through queue
      const result = await queueManager.queueOrProcess(
        authHeader, 
        smsData, 
        async (data) => {
          const finalMessage = `From: ${data.tokenDoc.project_name}\n\n${data.message}\n\nSent via SMS API Philippines`;
          
          const smsResult = await smsGateway.sendSMS(
            data.recipient, 
            finalMessage
          );

          if (!smsResult.success) {
            throw new Error(smsResult.error);
          }

          // ✅ Increment global counter FIRST
          const globalCount = await globalCounterService.incrementGlobalCounter();
          
          // Increment user's daily limit
          await apiKeyService.incrementUsage(
            data.tokenDocRef, 
            data.currentLimit
          );

          // Log SMS with global counter info
          await this.logSMS(
            data.tokenDoc.user_id, 
            data.recipient, 
            smsResult,
            globalCount
          );

          return {
            smsResponse: smsResult.data,
            usage: {
              user: {
                sent: data.currentLimit + 1,
                limit: LIMITS.DAILY_SMS_LIMIT,
                remaining: LIMITS.DAILY_SMS_LIMIT - (data.currentLimit + 1)
              }
            }
          };
        }
      );

      // Get queue stats
      const queueStats = queueManager.getQueueStats(authHeader);

      res.status(STATUS.SUCCESS).json({
        success: true,
        message: queueStats.queued_messages > 0 
          ? 'SMS queued successfully' 
          : 'SMS sent successfully',
        recipient: normalizedRecipient,
        sms_response: result.smsResponse,
        usage: result.usage,
        queue_info: {
          queued_messages: queueStats.queued_messages,
          next_available_in_seconds: queueStats.next_available_in,
          estimated_completion_time: queueStats.queued_messages > 0 
            ? `${queueStats.queued_messages * LIMITS.SMS_INTERVAL_SECONDS} seconds` 
            : 'now'
        }
      });

    } catch (error) {
      console.error('SMS sending error:', error);
      
      // If error occurred after incrementing, decrement global counter
      if (error.decrementGlobal) {
        await globalCounterService.decrementGlobalCounter();
      }
      
      if (error.response) {
        return res.status(error.response.status || STATUS.SERVER_ERROR).json({
          success: false,
          error: error.response.data || error.message
        });
      }

      res.status(STATUS.SERVER_ERROR).json({
        success: false,
        error: error.message
      });
    }
  }

  async handleMaliciousMessage(req, res, docRef, tokenDoc, authHeader, message) {
    console.log("API Key", authHeader, "attempted to send a malicious message:", message);

    const currentErrorCount = tokenDoc.error_count || 0;
    const result = await apiKeyService.updateMaliciousAttempt(
      docRef, 
      currentErrorCount
    );

    if (result.banned) {
      return res.status(STATUS.FORBIDDEN).json({
        success: false,
        error: 'API key has been banned',
        details: 'Your API key has been banned due to 3 consecutive malicious messages. Please contact support.',
        ban_date: result.ban_date,
        error_count: result.error_count,
        max_allowed_errors: LIMITS.MALICIOUS_ATTEMPTS_BAN
      });
    } else {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Malicious or scam message detected',
        details: 'This message appears to be spam, scam, or malicious content',
        warning: `This is malicious attempt ${result.error_count}/${LIMITS.MALICIOUS_ATTEMPTS_BAN}. After ${LIMITS.MALICIOUS_ATTEMPTS_BAN} attempts, your API key will be banned.`,
        attempts_remaining: result.attempts_remaining,
        error_count: result.error_count,
        max_allowed_errors: LIMITS.MALICIOUS_ATTEMPTS_BAN
      });
    }
  }

  async logSMS(userId, recipient, smsResult, globalCount) {
    try {
      await db.collection(COLLECTIONS.SMS_LOGS).add({
        user_id: userId,
        recipient,
        sent_at: new Date().toISOString(),
        status: smsResult.data?.state || 'sent',
        response: smsResult.data,
        date: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error('Failed to log SMS:', error);
    }
  }

  async getQueueStatus(req, res) {
    try {
      const authHeader = req.headers['x-api-key']?.trim();
      const queueStats = queueManager.getQueueStats(authHeader);
      
      const tokenDoc = req.apiKey?.data || {};
      
      // Include global stats
      const globalStats = await globalCounterService.getGlobalUsageStats();

      res.json({
        success: true,
        queue: queueStats,
        rate_limits: {
          user: {
            last_request: tokenDoc.last_requested_stamp || null,
            daily_usage: tokenDoc.limit || 0,
            daily_limit: LIMITS.DAILY_SMS_LIMIT,
            daily_remaining: LIMITS.DAILY_SMS_LIMIT - (tokenDoc.limit || 0)
          },
          global: globalStats
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(STATUS.SERVER_ERROR).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new SMSController();