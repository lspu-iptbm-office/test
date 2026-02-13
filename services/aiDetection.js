const axios = require('axios');
const { db, FieldValue } = require('../config/firebase');
const { AI, COLLECTIONS } = require('../config/constants');

class AIDetectionService {
  async detectMaliciousMessage(message) {
    try {
      const response = await axios.post(
        AI.URL,
        {
          model: AI.MODEL,
          messages: [
            {
              role: "system",
              content: `You are a cybersecurity classifier specialized in SMS threat detection.

Your task is to determine whether an SMS message contains malicious intent.

A message is malicious if its primary intent is to deceive, manipulate, defraud, impersonate, or trick the recipient into taking harmful action.

A message is NOT malicious if it is:
- A normal greeting
- A legitimate service notification
- A standard OTP message that does not attempt to extract confidential information from the recipient
- Informational without deceptive intent

Use contextual reasoning. Do not assume malicious intent without clear indicators of deception or harm.

If the malicious intent is clear → return true.
If there is no clear malicious intent → return false.

Return ONLY valid JSON in exactly one of the following formats:

{"malicious": "true"}
{"malicious": "false"}`
            },
            {
              role: "user",
              content: message
            }
          ],
          temperature: AI.TEMPERATURE,
          max_tokens: 150
        },
        {
          headers: {
            'Authorization': `Bearer ${AI.API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: AI.TIMEOUT
        }
      );

      const aiResponse = response.data.choices[0].message.content;
      console.log('AI Response:', aiResponse);

      return aiResponse;

    } catch (error) {
      console.error('AI Detection Error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      // Log error to Firestore
      await db.collection(COLLECTIONS.AI_ERRORS).add({
        message: message,
        error: error.message,
        timestamp: FieldValue.serverTimestamp()
      });
      
      return { malicious: "false" };
    }
  }

  parseMaliciousResponse(response) {
    try {
      if (typeof response === 'string') {
        return JSON.parse(response);
      }
      return response;
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return { malicious: "false" };
    }
  }
}

module.exports = new AIDetectionService();