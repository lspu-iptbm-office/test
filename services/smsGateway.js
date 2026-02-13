const axios = require('axios');
const { SMS_GATE } = require('../config/constants');
const pushService = require('../services/pushService');

class SMSGatewayService {
  constructor() {
    this.baseURL = SMS_GATE.URL;
    this.authString = Buffer.from(
      `${SMS_GATE.AUTH.username}:${SMS_GATE.AUTH.password}`
    ).toString('base64');
  }

  async sendSMS(phoneNumber, message) {
    try {
      const response = await axios.post(
        this.baseURL,
        {
          textMessage: {
            text: message
          },
          phoneNumbers: [phoneNumber]
        },
        {
          headers: {
            'Authorization': `Basic ${this.authString}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Send push notification to user about successful SMS
      await pushService.sendNotificationToUser(
        data.tokenDoc.user_id,
        'SMS API PH'
        `Your message to ${data.recipient} was sent successfully.`,
        { message: smsData.message }
      );

      return {
        success: true,
        data: {
          state: response.data.state,
          isHashed: response.data.isHashed,
          isEncrypted: response.data.isEncrypted,
          states: response.data.states
        }
      };
    } catch (error) {
      console.error('SMS Gateway Error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });

      return {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status
      };
    }
  }
}

module.exports = new SMSGatewayService();