const express = require('express');
const router = express.Router();
const smsController = require('../controllers/smsController');
const { authenticateApiKey } = require('../middleware/auth');
const { checkDailyLimit, checkRateLimit } = require('../middleware/rateLimiter');
const { checkGlobalDailyLimit } = require('../middleware/globalRateLimiter'); // New

router.post('/send/sms', 
  authenticateApiKey,
  checkDailyLimit,
  checkGlobalDailyLimit,
  checkRateLimit,
  smsController.sendSMS.bind(smsController)
);

router.get('/queue/status',
  authenticateApiKey,
  smsController.getQueueStatus.bind(smsController)
);

module.exports = router;