const axios = require('axios');
const { db } = require('../config/firebase');
const { EMAIL, COLLECTIONS } = require('../config/constants');
const emailCounterService = require('./emailCounterService');

class EmailService {
  constructor() {
    this.apiUrl = EMAIL.API_URL;
    this.apiKey = process.env.BREVO_API_KEY;
    this.sender = EMAIL.SENDER;
  }

  async sendSMSFallback(email, message, projectName) {
    try {
      const isLimitReached = await emailCounterService.isEmailLimitReached();
      const emailStats = await emailCounterService.getEmailUsageStats();

      if (isLimitReached) {
        console.log(`System daily limit reached (${emailStats.sent_today}/${EMAIL.DAILY_LIMIT})`);
        return {
          success: false,
          error: 'System daily limit has been reached',
        };
      }

      if (!this.apiKey) {
        console.error('BREVO_API_KEY is not configured');
        return { success: false, error: 'Email service not configured' };
      }

      const subject = `Message from ${projectName}`;
      
      // Simple HTML content
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>SMS API PH - System Notification</title>
    <style>
        /* Email-safe styles - inline CSS only, no Tailwind */
        .email-wrapper {
            background: #0f172a;
            padding: 32px 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: #1e293b;
            border-radius: 16px;
            padding: 32px;
            border: 1px solid #334155;
        }
        .header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 24px;
        }
        .logo-icon {
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, #3b82f6, #60a5fa);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .logo-text {
            font-size: 20px;
            font-weight: bold;
            background: linear-gradient(135deg, #3b82f6, #93c5fd);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(245, 158, 11, 0.2);
            border: 1px solid rgba(245, 158, 11, 0.3);
            border-radius: 100px;
            padding: 6px 16px;
            font-size: 13px;
            color: #fbbf24;
            margin-bottom: 20px;
        }
        .project-name {
            color: #3b82f6;
            font-size: 24px;
            font-weight: 700;
            margin: 16px 0 8px 0;
            padding-bottom: 8px;
            border-bottom: 1px solid #334155;
        }
        .message-content {
            color: #f8fafc;
            font-size: 16px;
            line-height: 1.6;
            margin: 24px 0;
            padding: 16px;
            background: #0f172a;
            border-radius: 12px;
            border-left: 4px solid #3b82f6;
            white-space: pre-line;
            word-wrap: break-word;
        }
        .divider {
            height: 1px;
            background: #334155;
            margin: 24px 0;
            border: none;
        }
        .footer {
            color: #94a3b8;
            font-size: 12px;
        }
        .footer-icon {
            display: inline-block;
            margin-right: 4px;
        }
        .status-dot {
            display: inline-block;
            width: 8px;
            height: 8px;
            background: #f59e0b;
            border-radius: 50%;
            margin-right: 6px;
            animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 0.6; transform: scale(0.9); }
            50% { opacity: 1; transform: scale(1.1); }
        }
        .ph-flag {
            display: inline-block;
            margin-right: 4px;
        }
        .support-note {
            margin-top: 16px;
            padding: 12px;
            background: rgba(59, 130, 246, 0.1);
            border-radius: 8px;
            font-size: 12px;
            color: #94a3b8;
            border: 1px solid #334155;
        }
        .credit {
            margin-top: 20px;
            padding-top: 16px;
            border-top: 1px solid #334155;
            font-size: 11px;
            color: #64748b;
            text-align: center;
        }
        a {
            color: #60a5fa;
            text-decoration: none;
        }
        /* Dark mode adjustments */
        @media (prefers-color-scheme: dark) {
            .email-wrapper {
                background: #020617;
            }
            .email-container {
                background: #0f172a;
            }
        }
    </style>
</head>
<body style="margin:0; padding:0; background:#0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
    <div class="email-wrapper" style="background: #0f172a; padding: 32px 20px;">
        <div class="email-container" style="max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 32px; border: 1px solid #334155;">
            
            <!-- Header with Logo -->
            <div class="header" style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
                <div>
                    <span class="logo-text" style="font-size: 20px; font-weight: bold; background: linear-gradient(135deg, #3b82f6, #93c5fd); -webkit-background-clip: text; background-clip: text; color: #3b82f6;">SMS API PH</span>
                    <div style="color: #94a3b8; font-size: 12px;">🇵🇭 Philippines Only</div>
                </div>
            </div>

            <!-- Project Name -->
            <div style="color: #3b82f6; font-size: 14px; margin-bottom: 4px;">PROJECT</div>
            <h3 style="color: #f8fafc; font-size: 28px; font-weight: 700; margin: 0 0 8px 0;">
                ${projectName}
            </h3>

            <!-- Message Content -->
            <div class="message-content" style="color: #f8fafc; font-size: 16px; line-height: 1.6; margin: 24px 0; padding: 20px; background: #0f172a; border-radius: 12px; border-left: 4px solid #3b82f6; white-space: pre-line; word-wrap: break-word;">
                ${message.replace(/\n/g, '<br>')}
            </div>

            <!-- Divider -->
            <hr class="divider" style="height: 1px; background: #334155; margin: 24px 0; border: none;">

            <!-- Footer -->
            <div class="footer" style="color: #94a3b8; font-size: 12px;">
                <p style="margin: 0 0 8px 0; display: flex; align-items: center; gap: 4px;">
                    <span style="font-size: 14px;">📧</span> 
                    Sent via email because system limit has been reached
                </p>
                <p style="margin: 0 0 4px 0; color: #cbd5e1;">
                    ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}
                </p>
                <p style="margin: 8px 0 0 0; font-size: 11px; color: #64748b;">
                    • This is an automated message from SMS API Philippines<br>
                    • We're working to restore SMS sending as soon as possible
                </p>
            </div>

            <!-- Credit -->
            <div class="credit" style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #334155; font-size: 11px; color: #64748b; text-align: center;">
                Made with 💙 for the Philippine developer community by 
                <a href="https://marknicholasrazon.netlify.app" target="_blank" style="color: #60a5fa; text-decoration: none;">Mark Nicholas Razon</a>
                <br>
                © 2026 SMS API Philippines
            </div>
        </div>
    </div>
</body>
</html>
      `;

      const response = await axios.post(
        `${this.apiUrl}/smtp/email`,
        {
          sender: this.sender,
          to: [{ email }],
          subject,
          htmlContent
        },
        {
          headers: {
            'api-key': this.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const newCount = await emailCounterService.incrementEmailCounter();
      const updatedStats = await emailCounterService.getEmailUsageStats();

      // Simple log
      await db.collection(COLLECTIONS.EMAIL_LOGS).add({
        email,
        subject,
        status: 'sent',
        sent_at: new Date().toISOString(),
        daily_count: newCount,
        date: emailCounterService.getTodayDate()
      });

      return { success: true, messageId: response.data.messageId };

    } catch (error) {
      console.error('Email fallback failed:', error.message);
      
      await db.collection(COLLECTIONS.EMAIL_LOGS).add({
        email,
        subject: `Message from ${projectName}`,
        status: 'failed',
        error: error.message,
        sent_at: new Date().toISOString(),
        date: emailCounterService.getTodayDate()
      });

      return { 
        success: false, 
        error: error.response?.data || error.message 
      };
    }
  }
}

module.exports = new EmailService();