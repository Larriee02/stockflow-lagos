const env = require('../config/env');

let nodemailerInstance = null;
function getNodemailer() {
  if (!nodemailerInstance && env.SMTP_HOST) {
    try {
      const nodemailer = require('nodemailer');
      nodemailerInstance = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: env.SMTP_USER
          ? {
              user: env.SMTP_USER,
              pass: env.SMTP_PASS,
            }
          : undefined,
      });
    } catch (err) {
      console.warn('[Notification] Nodemailer transport creation warning:', err.message);
    }
  }
  return nodemailerInstance;
}

function buildOtpEmailHtml({ code, recipientName, purpose, expiresInMinutes = 10 }) {
  const isSignup = purpose === 'SIGNUP';
  const actionText = isSignup ? 'complete your registration' : 'sign in to your account';
  const title = isSignup ? 'Confirm Your Account' : 'Verification Code';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - StockFlow</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0b1120;
      color: #e2e8f0;
      margin: 0;
      padding: 30px 15px;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      background: #111827;
      border: 1px solid #1e293b;
      border-radius: 20px;
      padding: 36px 28px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
      padding-bottom: 18px;
      border-bottom: 1px solid #1e293b;
    }
    .logo-badge {
      background: linear-gradient(135deg, #2563eb, #0284c7);
      color: #ffffff;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 18px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .brand-subtitle {
      font-size: 12px;
      color: #94a3b8;
      margin: 2px 0 0 0;
    }
    h2 {
      color: #ffffff;
      font-size: 18px;
      margin: 0 0 12px 0;
    }
    p {
      color: #94a3b8;
      font-size: 14px;
      line-height: 1.6;
      margin: 0 0 20px 0;
    }
    .otp-box {
      background: #0f172a;
      border: 1px solid #2563eb;
      border-radius: 16px;
      padding: 22px;
      text-align: center;
      margin: 24px 0;
    }
    .otp-code {
      font-family: 'SF Mono', Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
      font-size: 36px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #38bdf8;
      display: inline-block;
      margin: 6px 0;
    }
    .otp-hint {
      font-size: 12px;
      color: #64748b;
      margin-top: 6px;
    }
    .footer {
      margin-top: 32px;
      padding-top: 20px;
      border-top: 1px solid #1e293b;
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-badge">SF</div>
      <div>
        <h1 class="brand-title">StockFlow</h1>
        <p class="brand-subtitle">Retail Inventory & Cashbook Platform</p>
      </div>
    </div>

    <h2>Hello ${recipientName || 'there'},</h2>
    <p>Use the verification code below to ${actionText}:</p>

    <div class="otp-box">
      <div class="otp-code">${code}</div>
      <div class="otp-hint">Valid for the next ${expiresInMinutes} minutes</div>
    </div>

    <p>Never share this code with anyone. StockFlow team members will never ask for your verification code.</p>

    <div class="footer">
      This email was sent for security verification from StockFlow.<br>
      If you did not initiate this request, you can safely ignore this email.
    </div>
  </div>
</body>
</html>
  `;
}

class NotificationService {
  /**
   * Send Email Notification with OTP
   */
  async sendEmailOtp({ to, code, recipientName = '', purpose = 'LOGIN' }) {
    const isSignup = purpose === 'SIGNUP';
    const subject = isSignup
      ? `StockFlow Verification Code: ${code}`
      : `Your StockFlow Sign-In Code: ${code}`;
    const text = `Hello ${recipientName || 'there'},\n\nYour StockFlow verification code is: ${code}\nThis code will expire in 10 minutes.\n\nDo not share this code with anyone.`;
    const html = buildOtpEmailHtml({ code, recipientName, purpose });

    console.log(`[Notification:Email] Sending OTP ${code} to ${to} (${purpose})`);

    // 1. Try Resend API
    if (env.RESEND_API_KEY) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: env.EMAIL_FROM,
            to,
            subject,
            html,
            text,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          console.log('[Notification:Email] Delivered via Resend:', data.id);
          return { success: true, provider: 'resend', id: data.id };
        }
        const errText = await res.text();
        console.warn('[Notification:Email] Resend API error:', errText);
      } catch (err) {
        console.warn('[Notification:Email] Resend delivery failed:', err.message);
      }
    }

    // 2. Try SendGrid API
    if (env.SENDGRID_API_KEY) {
      try {
        const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from: { email: env.EMAIL_FROM.replace(/.*<(.+)>/, '$1') },
            subject,
            content: [
              { type: 'text/plain', value: text },
              { type: 'text/html', value: html },
            ],
          }),
        });
        if (res.ok || res.status === 202) {
          console.log('[Notification:Email] Delivered via SendGrid');
          return { success: true, provider: 'sendgrid' };
        }
        const errText = await res.text();
        console.warn('[Notification:Email] SendGrid API error:', errText);
      } catch (err) {
        console.warn('[Notification:Email] SendGrid delivery failed:', err.message);
      }
    }

    // 3. Try Nodemailer SMTP
    const transporter = getNodemailer();
    if (transporter) {
      try {
        const info = await transporter.sendMail({
          from: env.EMAIL_FROM,
          to,
          subject,
          text,
          html,
        });
        console.log('[Notification:Email] Delivered via SMTP:', info.messageId);
        return { success: true, provider: 'smtp', id: info.messageId };
      } catch (err) {
        console.warn('[Notification:Email] SMTP delivery failed:', err.message);
      }
    }

    // 4. Fallback: Log to console
    console.log(`[Notification:Email] (Simulated Delivery) To: ${to} | Code: ${code} | Purpose: ${purpose}`);
    return { success: true, provider: 'console-simulated' };
  }

  /**
   * Format phone number to international E.164 (e.g. 0803... -> +234803...)
   */
  formatPhoneNumber(phone) {
    if (!phone) return null;
    let cleaned = String(phone).replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) return cleaned;
    if (cleaned.startsWith('0') && cleaned.length >= 10) {
      // Default Nigerian telecom prefix if starting with 0
      return `+234${cleaned.slice(1)}`;
    }
    if (cleaned.length === 10) {
      return `+234${cleaned}`;
    }
    return `+${cleaned}`;
  }

  /**
   * Send SMS Notification with OTP
   */
  async sendSmsOtp({ phone, code, purpose = 'LOGIN' }) {
    const formattedPhone = this.formatPhoneNumber(phone);
    if (!formattedPhone) {
      throw new Error('Valid phone number required for SMS notification.');
    }

    const isSignup = purpose === 'SIGNUP';
    const message = isSignup
      ? `Your StockFlow registration code is ${code}. Valid for 10 minutes. Do not share this code.`
      : `Your StockFlow sign-in verification code is ${code}. Valid for 10 minutes. Do not share.`;

    console.log(`[Notification:SMS] Sending OTP ${code} to ${formattedPhone} (${purpose})`);

    // 1. Try Termii API (Primary for Nigeria / West Africa)
    if (env.TERMII_API_KEY) {
      try {
        const res = await fetch('https://api.ng.termii.com/api/sms/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: formattedPhone.replace('+', ''),
            from: env.TERMII_SENDER_ID || 'StockFlow',
            sms: message,
            type: 'plain',
            channel: 'generic',
            api_key: env.TERMII_API_KEY,
          }),
        });
        const data = await res.json();
        if (res.ok && data.message_id) {
          console.log('[Notification:SMS] Delivered via Termii:', data.message_id);
          return { success: true, provider: 'termii', id: data.message_id };
        }
        console.warn('[Notification:SMS] Termii response:', data);
      } catch (err) {
        console.warn('[Notification:SMS] Termii delivery failed:', err.message);
      }
    }

    // 2. Try Twilio API
    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER) {
      try {
        const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
        const params = new URLSearchParams();
        params.append('To', formattedPhone);
        params.append('From', env.TWILIO_PHONE_NUMBER);
        params.append('Body', message);

        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
          }
        );
        const data = await res.json();
        if (res.ok && data.sid) {
          console.log('[Notification:SMS] Delivered via Twilio:', data.sid);
          return { success: true, provider: 'twilio', id: data.sid };
        }
        console.warn('[Notification:SMS] Twilio response:', data);
      } catch (err) {
        console.warn('[Notification:SMS] Twilio delivery failed:', err.message);
      }
    }

    // 3. Try Generic Webhook
    if (env.SMS_WEBHOOK_URL) {
      try {
        const res = await fetch(env.SMS_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: formattedPhone,
            message,
            code,
            purpose,
          }),
        });
        if (res.ok) {
          console.log('[Notification:SMS] Delivered via SMS Webhook');
          return { success: true, provider: 'webhook' };
        }
      } catch (err) {
        console.warn('[Notification:SMS] SMS Webhook delivery failed:', err.message);
      }
    }

    // 4. Fallback: Log to console
    console.log(`[Notification:SMS] (Simulated Delivery) To: ${formattedPhone} | Code: ${code} | Message: ${message}`);
    return { success: true, provider: 'console-simulated', phone: formattedPhone };
  }
}

module.exports = new NotificationService();
