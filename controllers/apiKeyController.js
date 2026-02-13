const { STATUS } = require('../config/constants');
const { normalizePHNumber, isValidEmail } = require('../utils/validators');
const apiKeyService = require('../services/apiKeyService');
const smsGateway = require('../services/smsGateway');

class APIKeyController {
  async createAPIKey(req, res) {
    try {
      const { email, phone_number, project_name } = req.body;

      // Validation
      if (!email || !phone_number || !project_name) {
        return res.status(STATUS.BAD_REQUEST).json({
          success: false,
          error: 'email, phone_number, and project_name are required'
        });
      }

      if (!isValidEmail(email)) {
        return res.status(STATUS.BAD_REQUEST).json({
          success: false,
          error: 'Invalid email format'
        });
      }

      const normalizedPhone = normalizePHNumber(phone_number);
      if (!normalizedPhone) {
        return res.status(STATUS.BAD_REQUEST).json({
          success: false,
          error: 'Invalid Philippine phone number format'
        });
      }

      // Check duplicates
      const [emailExists, phoneExists] = await Promise.all([
        apiKeyService.checkExistingEmail(email),
        apiKeyService.checkExistingPhone(normalizedPhone)
      ]);

      if (emailExists) {
        return res.status(STATUS.CONFLICT).json({
          success: false,
          error: 'Email already exists'
        });
      }

      if (phoneExists) {
        return res.status(STATUS.CONFLICT).json({
          success: false,
          error: 'Phone number already exists'
        });
      }

      // Create API Key
      const apiKeyData = await apiKeyService.createAPIKey(
        email,
        normalizedPhone,
        project_name
      );

      // Prepare SMS
      const smsMessage = `API Key Created Successfully!

Project: ${project_name}
User ID: ${apiKeyData.user_id}
API Key: ${apiKeyData.api_key}
Email: ${email}
Start Date: ${apiKeyData.start_date}

Save this API key securely. You will not be able to retrieve it again.`;

      // Send SMS
      const smsResult = await smsGateway.sendSMS(normalizedPhone, smsMessage);

      if (!smsResult.success) {
        // Log but don't fail the request
        console.error('Failed to send SMS notification:', smsResult.error);
      }

      res.status(STATUS.CREATED).json({
        success: true,
        message: 'API key generated successfully',
        firestore_id: apiKeyData.docId,
        api_key: apiKeyData.api_key,
        user_id: apiKeyData.user_id,
        sms_sent: smsResult.success
      });

    } catch (error) {
      console.error('API Key creation error:', error);
      res.status(STATUS.SERVER_ERROR).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new APIKeyController();