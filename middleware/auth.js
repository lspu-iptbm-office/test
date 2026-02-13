const { db } = require('../config/firebase');
const { COLLECTIONS } = require('../config/constants');
const { isValidApiKeyFormat } = require('../utils/validators');

const authenticateApiKey = async (req, res, next) => {
  try {
    const authHeader = req.headers['x-api-key']?.trim();

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Authorization token is required'
      });
    }

    if (!isValidApiKeyFormat(authHeader)) {
      return res.status(403).json({
        success: false,
        error: 'Invalid API key format'
      });
    }

    const tokenSnap = await db
      .collection(COLLECTIONS.API_KEYS)
      .where('api_key', '==', authHeader)
      .limit(1)
      .get();

    if (tokenSnap.empty) {
      return res.status(403).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    const tokenDocRef = tokenSnap.docs[0].ref;
    const tokenDoc = tokenSnap.docs[0].data();

    // Check if banned
    if (tokenDoc.ban_reason === 'Malicious messages detected') {
      return res.status(403).json({
        success: false,
        error: 'This API key has been banned due to multiple consecutive malicious messages. Please contact support.',
        ban_date: tokenDoc.ban_date,
        error_count: tokenDoc.error_count || 0
      });
    }

    // Check if active
    if (tokenDoc.is_active !== true) {
      return res.status(403).json({
        success: false,
        error: 'API key is inactive'
      });
    }

    // Attach to request
    req.apiKey = {
      docRef: tokenDocRef,
      data: tokenDoc,
      key: authHeader
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

module.exports = { authenticateApiKey };