// Philippine phone number validator & normalizer
const normalizePHNumber = (phone) => {
  if (!phone) return null;
  
  let cleaned = phone.replace(/\s|-/g, '');

  if (cleaned.startsWith('09')) {
    cleaned = '+63' + cleaned.slice(1);
  } else if (cleaned.startsWith('639')) {
    cleaned = '+' + cleaned;
  }

  const phRegex = /^\+639\d{9}$/;
  if (!phRegex.test(cleaned)) return null;

  return cleaned;
};

// Email validator
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Message validator
const validateMessage = (message) => {
  const errors = [];
  
  if (!message || message.trim().length === 0) {
    errors.push('Message cannot be empty');
  }
  
  if (message && message.length > 1000) {
    errors.push('Message exceeds maximum length of 1000 characters');
  }
  
  if (message && message.toLowerCase().includes('http')) {
    errors.push('Links are not allowed in messages');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// API Key validator
const isValidApiKeyFormat = (apiKey) => {
  return apiKey && (apiKey.startsWith('sk-') || apiKey.startsWith('sk_')) && apiKey.length > 20;
};

module.exports = {
  normalizePHNumber,
  isValidEmail,
  validateMessage,
  isValidApiKeyFormat
};