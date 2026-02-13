const express = require('express');
const router = express.Router();
const apiKeyController = require('../controllers/apiKeyController');
const apiKeyRegistrationLimiter = require('../middlewares/apiKeyRegistrationLimiter');

router.post('/', apiKeyRegistrationLimiter, apiKeyController.createAPIKey.bind(apiKeyController));

module.exports = router;