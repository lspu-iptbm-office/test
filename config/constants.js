require('dotenv').config();

module.exports = {
  // SMS Gateway Config
  SMS_GATE: {
    URL: 'https://api.sms-gate.app/3rdparty/v1/messages',
    AUTH: {
      username: process.env.SMS_GATE_USERNAME,
      password: process.env.SMS_GATE_PASSWORD
    }
  },

  // Email Config
  EMAIL: {
    API_URL: 'https://api.brevo.com/v3',
    API_KEY: process.env.BREVO_API_KEY,
    SENDER: {
      name: 'SMS API Philippines',
      email: 'smsapiph@gmail.com'
    },
    DAILY_LIMIT: 290,
    THRESHOLD: 290
  },

  // Admin emails for notifications
  ADMIN_EMAILS: [
    'smsapiph@gmail.com',
  ],
  
  // Push Notification Config
  WEB_PUSH: {
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT,
    TTL: 2419200, // 28 days in seconds
  },

  // AI Detection Config
  AI: {
    URL: 'https://gen.pollinations.ai/v1/chat/completions',
    API_KEY: process.env.AI_API,
    MODEL: 'openai',
    TIMEOUT: 10000,
    TEMPERATURE: 0.1
  },

  // Rate Limits
  LIMITS: {
    DAILY_SMS_LIMIT: 20,
    GLOBAL_DAILY_SMS_LIMIT: 300,
    SMS_INTERVAL_SECONDS: 2,
    MALICIOUS_ATTEMPTS_BAN: 3,
    API_KEY_PREFIX: 'sk-',
    EMAIL_NOTIFICATION_THRESHOLD: 450,
    EMAIL_DAILY_LIMIT: 290,
    API_KEY_REGISTRATION_DAILY_LIMIT: 50,
  },

  // Collections
  COLLECTIONS: {
    API_KEYS: 'api_keys',
    AI_ERRORS: 'ai_detection_errors',
    SMS_LOGS: 'sms_logs',
    GLOBAL_COUNTERS: 'global_counters',
    EMAIL_LOGS: 'email_logs',
    EMAIL_COUNTERS: 'email_counters',
    PUSH_SUBSCRIPTIONS: 'push_subscriptions',
    PUSH_NOTIFICATIONS: 'push_notifications',
    SYSTEM_COUNTERS: 'system_counters'
  },

  // Status Codes
  STATUS: {
    SUCCESS: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    SERVER_ERROR: 500
  }
};