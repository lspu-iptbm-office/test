const express = require('express');
const router = express.Router();
const pushController = require('../controllers/pushController');
const { authenticateApiKey } = require('../middleware/auth');

router.get('/push/vapid', pushController.getVapidPublicKey);

router.post('/push/subscribe', 
  authenticateApiKey, 
  pushController.subscribe.bind(pushController)
);

router.post('/push/unsubscribe', 
  authenticateApiKey, 
  pushController.unsubscribe.bind(pushController)
);

router.get('/push/status', 
  authenticateApiKey, 
  pushController.getPushStatus.bind(pushController)
);

module.exports = router;