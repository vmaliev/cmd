const nodemailer = require('nodemailer');

// Email configuration
const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.example.com',
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'user@example.com',
    pass: process.env.SMTP_PASS || 'password'
  }
};

// Create transporter
const transporter = nodemailer.createTransport(emailConfig);

/**
 * Send email using nodemailer
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text content
 * @param {string} options.html - HTML content
 * @param {string} options.from - Sender email (optional)
 * @returns {Promise<Object>} Email send result
 */
async function sendEmail(options) {
  try {
    const mailOptions = {
      from: options.from || process.env.SMTP_FROM || 'noreply@system.local',
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return result;
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
}

/**
 * Send verification email
 * @param {string} to - Recipient email
 * @param {string} verificationToken - Verification token
 * @param {string} baseUrl - Base URL for verification link
 * @returns {Promise<Object>} Email send result
 */
async function sendVerificationEmail(to, verificationToken, baseUrl) {
  const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`;
  
  return sendEmail({
    to,
    subject: 'Verify Your Email Address',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to IT Support System!</h2>
        <p>Thank you for registering. Please click the button below to verify your email address:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
        <p>If you didn't create this account, please ignore this email.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          This is an automated message. Please do not reply to this email.
        </p>
      </div>
    `,
    text: `
      Welcome to IT Support System!
      
      Please verify your email address by clicking this link:
      ${verificationUrl}
      
      If you didn't create this account, please ignore this email.
    `
  });
}

/**
 * Send password reset email
 * @param {string} to - Recipient email
 * @param {string} resetToken - Reset token
 * @param {string} baseUrl - Base URL for reset link
 * @returns {Promise<Object>} Email send result
 */
async function sendPasswordResetEmail(to, resetToken, baseUrl) {
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
  
  return sendEmail({
    to,
    subject: 'Password Reset Request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>You requested a password reset for your IT Support System account.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        <p><strong>This link will expire in 1 hour.</strong></p>
        <p>If you didn't request this password reset, please ignore this email.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          This is an automated message. Please do not reply to this email.
        </p>
      </div>
    `,
    text: `
      Password Reset Request
      
      You requested a password reset. Click this link to reset your password:
      ${resetUrl}
      
      This link will expire in 1 hour.
      
      If you didn't request this reset, please ignore this email.
    `
  });
}

/**
 * Send welcome email
 * @param {string} to - Recipient email
 * @param {string} name - User name
 * @returns {Promise<Object>} Email send result
 */
async function sendWelcomeEmail(to, name) {
  return sendEmail({
    to,
    subject: 'Welcome to IT Support System',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to IT Support System!</h2>
        <p>Hello ${name},</p>
        <p>Your account has been successfully created and verified. You can now log in to access the IT Support System.</p>
        <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          This is an automated message. Please do not reply to this email.
        </p>
      </div>
    `,
    text: `
      Welcome to IT Support System!
      
      Hello ${name},
      
      Your account has been successfully created and verified. You can now log in to access the IT Support System.
      
      If you have any questions or need assistance, please don't hesitate to contact our support team.
    `
  });
}

/**
 * Test email configuration
 * @returns {Promise<boolean>} True if email configuration is working
 */
async function testEmailConfig() {
  try {
    await transporter.verify();
    console.log('Email configuration is valid');
    return true;
  } catch (error) {
    console.error('Email configuration error:', error);
    return false;
  }
}

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  testEmailConfig
}; 