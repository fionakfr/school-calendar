const nodemailer = require('nodemailer');

function createTransport() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  // Fallback: throws so dev token is returned instead
  throw new Error('SMTP not configured');
}

async function sendMagicLink(email, name, token) {
  const transport = createTransport();
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const link = `${baseUrl}/auth/verify/${token}`;

  await transport.sendMail({
    from: process.env.SMTP_FROM || '"School Calendar" <noreply@example.com>',
    to: email,
    subject: "Your link to School Calendar",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #fff;">
        <h2 style="color: #2563eb; margin-bottom: 8px;">School Calendar</h2>
        <p style="color: #374151;">Hi ${name},</p>
        <p style="color: #374151;">Click the button below to sign in. This link expires in 30 minutes.</p>
        <a href="${link}" style="display:inline-block;margin:24px 0;padding:14px 28px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
          Sign in to Calendar
        </a>
        <p style="color: #9ca3af; font-size: 13px;">Or copy this link: ${link}</p>
        <p style="color: #9ca3af; font-size: 12px;">If you didn't request this, you can ignore this email.</p>
      </div>
    `,
  });
}

module.exports = { sendMagicLink };
