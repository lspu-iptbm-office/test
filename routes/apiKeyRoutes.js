const express = require('express');
const router = express.Router();
const apiKeyController = require('../controllers/apiKeyController');

router.post('/', apiKeyController.createAPIKey.bind(apiKeyController));

module.exports = router;