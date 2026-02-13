const express = require('express');
const cors = require('cors'); 
const axios = require('axios');
const admin = require('firebase-admin');
const crypto = require('crypto');
require('dotenv').config();

// ===============================
// FIREBASE ADMIN INIT
// ===============================
let privateKey = process.env.FIREBASE_PRIVATE_KEY;
if (privateKey) {
  privateKey = privateKey.replace(/\\n/g, '\n');
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey
  })
});

const db = admin.firestore();

// ===============================
// EXPRESS SETUP
// ===============================
const app = express();
app.use(cors());
app.use(express.json());

// ===============================
// SMS GATE CONFIG
// ===============================
const SMS_GATE_URL = 'https://api.sms-gate.app/3rdparty/v1/messages';

const SMS_GATE_AUTH = {
  username: process.env.SMS_GATE_USERNAME,
  password: process.env.SMS_GATE_PASSWORD
};

// ===============================
// HELPERS
// ===============================
const generateApiKey = () => {
  return 'sk-' + crypto.randomBytes(12).toString('hex');
};

const generateUserId = () => {
  return crypto.randomBytes(10).toString('hex');
};

// PH Normalize & validate PH phone number
const normalizePHNumber = (phone) => {
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

// AI Powered Suspicious/Malicious Message Detection
async function detectMaliciousMessageAI(message) {
  try {
    const response = await axios.post(
      'https://gen.pollinations.ai/v1/chat/completions',
      {
        model: "openai",
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
        temperature: 0.1, // Low temperature for consistent results
        max_tokens: 150
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.AI_API}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    // Parse the AI response
    const aiResponse = response.data.choices[0].message.content;
    console.log('AI Response:', aiResponse);

    return aiResponse;

  } catch (error) {
    console.error('AI Detection Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    // Pero log the error
    await db.collection('ai_detection_errors').add({
      message: message,
      error: error.message,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return {
      isMalicious: false,
      isSuspicious: false,
      confidence: 0,
      reason: "AI detection service unavailable",
      categories: ["none"]
    };
  }
}

// ===============================
// SEND API KEY
// ===============================
app.post('/send/api', async (req, res) => {
  try {
    const { email, phone_number, project_name } = req.body;

    if (!email || !phone_number || !project_name) {
      return res.status(400).json({
        success: false,
        error: 'email, phone_number, and project_name are required'
      });
    }

    const normalizedPhone = normalizePHNumber(phone_number);
    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Philippine phone number format'
      });
    }

    const emailSnap = await db
      .collection('api_keys')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (!emailSnap.empty) {
      return res.status(409).json({
        success: false,
        error: 'Email already exists'
      });
    }

    const phoneSnap = await db
      .collection('api_keys')
      .where('phone_number', '==', normalizedPhone)
      .limit(1)
      .get();

    if (!phoneSnap.empty) {
      return res.status(409).json({
        success: false,
        error: 'Phone number already exists'
      });
    }

    const api_key = generateApiKey();
    const user_id = generateUserId();
    const now = new Date().toISOString();
    const start_date = now.split('T')[0];

    const smsMessage = `API Key Created Successfully!

Project: ${project_name}
User ID: ${user_id}
API Key: ${api_key}
Email: ${email}
Start Date: ${start_date}

Save this API key securely. You will not be able to retrieve it again.`;

    const authString = Buffer.from(`${SMS_GATE_AUTH.username}:${SMS_GATE_AUTH.password}`).toString('base64');

    const smsResponse = await axios.post(
      'https://api.sms-gate.app/3rdparty/v1/messages',
      {
        textMessage: {
          text: smsMessage
        },
        phoneNumbers: [normalizedPhone]
      },
      {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const docRef = await db.collection('api_keys').add({
      api_key,
      email,
      phone_number: normalizedPhone,
      project_name,
      user_id,
      is_active: true,
      start_date,
      created_at: now,
      updated_at: now
    });

    res.json({
      success: true,
      message: 'API key generated and SMS sent',
      firestore_id: docRef.id
    });

  } catch (error) {
    console.error('SMS sending error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

app.post('/send/sms', async (req, res) => {
  try {
    const { recipient, message } = req.body;
    const authHeader = req.headers['x-api-key']?.trim();

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Authorization token is required'
      });
    }

    const tokenSnap = await db
      .collection('api_keys')
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

    if (tokenDoc.is_active !== true) {
      if (tokenDoc.ban_reason === 'Malicious messages detected') {
        return res.status(403).json({
          success: false,
          error: 'This API key has been banned due to multiple consecutive malicious messages. Please contact support.',
          ban_date: tokenDoc.ban_date,
          error_count: tokenDoc.error_count || 0
        });
      }
      
      return res.status(403).json({
        success: false,
        error: 'API key is inactive'
      });
    }

    if (!recipient || !message) {
      return res.status(400).json({
        success: false,
        error: 'recipient and message are required'
      });
    }

    if (message?.toLowerCase().includes('http')) {
      return res.status(400).json({
        success: false,
        error: 'Links are not allowed in messages'
      });
    }

    const normalizedRecipient = normalizePHNumber(recipient);
    if (!normalizedRecipient) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Philippine phone number format'
      });
    }

    const currentLimit = tokenDoc.limit || 0;
    const MAX_LIMIT = 50;

    if (currentLimit >= MAX_LIMIT) {
      return res.status(403).json({
        success: false,
        error: 'Message limit reached (50/50)',
        details: 'This API has a temporary limit of 50 messages per day. We will return to no limit when the volume goes down.',
        current_usage: currentLimit,
        max_allowed: MAX_LIMIT
      });
    }

    const lastSent = tokenDoc.updated_at ? new Date(tokenDoc.updated_at) : null;
    const now = new Date();

    if (lastSent && now - lastSent < 10000) {
      const waitTime = Math.ceil((10000 - (now - lastSent)) / 1000);
      return res.status(429).json({
        success: false,
        error: `Rate limit exceeded. Try again in ${waitTime} second(s).`
      });
    }

    const isMalicious = await detectMaliciousMessageAI(message);

    console.log('AI Detection Result:', isMalicious);

    const maliciousObj = typeof isMalicious === 'string' 
      ? JSON.parse(isMalicious) 
      : isMalicious;

    if (maliciousObj && maliciousObj.malicious === "true") {
      console.log("API Key", authHeader, "attempted to send a malicious message:", message);

      const currentErrorCount = tokenDoc.error_count || 0;
      const newErrorCount = currentErrorCount + 1;

      const updateData = {
        error_count: newErrorCount,
        last_malicious_attempt: new Date().toISOString()
      };

      if (newErrorCount >= 3) {
        updateData.is_active = false;
        updateData.ban_reason = 'Malicious messages detected';
        updateData.ban_date = new Date().toISOString();
        
        await tokenDocRef.update(updateData);
        
        return res.status(403).json({
          success: false,
          error: 'API key has been banned',
          details: 'Your API key has been banned due to 3 consecutive malicious messages. Please contact support.',
          ban_date: updateData.ban_date,
          error_count: newErrorCount,
          max_allowed_errors: 3
        });
      } else {
        await tokenDocRef.update(updateData);
        
        return res.status(400).json({
          success: false,
          error: 'Malicious or scam message detected',
          details: 'This message appears to be spam, scam, or malicious content',
          warning: `This is malicious attempt ${newErrorCount}/3. After 3 attempts, your API key will be banned.`,
          attempts_remaining: 3 - newErrorCount,
          error_count: newErrorCount,
          max_allowed_errors: 3
        });
      }
    }

    if (tokenDoc.error_count > 0) {
      await tokenDocRef.update({
        error_count: 0,
        last_malicious_attempt: null
      });
    }

    const finalMessage = `From: ${tokenDoc.project_name}\n\n${message}\n\nSent via SMS API Philippines`;

    const authString = Buffer.from(`${SMS_GATE_AUTH.username}:${SMS_GATE_AUTH.password}`).toString('base64');

    const smsResponse = await axios.post(
      SMS_GATE_URL,
      {
        textMessage: {
          text: finalMessage
        },
        phoneNumbers: [normalizedRecipient]
      },
      {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json'
        }
      }
    );

    await tokenDocRef.update({
      updated_at: now.toISOString(),
      limit: currentLimit + 1
    });

    res.json({
      success: true,
      message: 'SMS sent successfully',
      recipient: normalizedRecipient,
      sms_response: {
        state: smsResponse.data.state,
        isHashed: smsResponse.data.isHashed,
        isEncrypted: smsResponse.data.isEncrypted,
        states: smsResponse.data.states
      },
      usage: {
        sent: currentLimit + 1,
        limit: MAX_LIMIT,
        remaining: MAX_LIMIT - (currentLimit + 1)
      }
    });

  } catch (error) {
    console.error('SMS sending error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

// ===============================
// START SERVER
// ===============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 SMS API running on http://localhost:${PORT}`);
});