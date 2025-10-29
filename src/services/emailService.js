/**
 * Email Service
 *
 * This service handles all email-related functionality:
 * - OTP emails for registration and login
 * - Password reset emails
 * - Welcome emails
 * - Appointment notifications (future)
 *
 * Uses Nodemailer with Gmail SMTP
 *
 * @module emailService
 */

import pkg from 'nodemailer';
import dotenv from 'dotenv';

const { createTransport } = pkg;

dotenv.config();

/**
 * Helper function to get display name for role
 */
const getRoleDisplay = (role) => {
  if (role === 'doctor') return 'Doctor';
  if (role === 'patient') return 'Patient';
  return 'Admin';
};

/**
 * Create reusable nodemailer transporter
 * Configuration from environment variables
 */
const createTransporter = () => {
  // Check if email service is configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.warn('[WARNING] Email service not configured. Set EMAIL_USER and EMAIL_PASSWORD in .env');
    return null;
  }

  try {
    const transporter = createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      // Additional security options
      secure: true, // Use TLS
      tls: {
        rejectUnauthorized: true,
      },
    });

    console.log('[SUCCESS] Email service configured successfully');
    return transporter;
  } catch (error) {
    console.error('[ERROR] Error configuring email service:', error.message);
    return null;
  }
};

const transporter = createTransporter();

/**
 * HTML template for OTP email
 * @param {String} name - User's name
 * @param {String} otp - 6-digit OTP
 * @param {String} purpose - Purpose of OTP (registration/login)
 * @returns {String} HTML email template
 */
const getOTPEmailTemplate = (name, otp, purpose) => {
  const actionText = purpose === 'registration' ? 'complete your registration' : 'log in to your account';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background: #ffffff;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #ffffff;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
        }
        .content {
          padding: 40px 30px;
        }
        .otp-box {
          background: #f8f9fa;
          border: 2px dashed #667eea;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
          margin: 30px 0;
        }
        .otp-code {
          font-size: 36px;
          font-weight: bold;
          color: #667eea;
          letter-spacing: 8px;
          margin: 10px 0;
        }
        .info-box {
          background: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .warning-box {
          background: #f8d7da;
          border-left: 4px solid #dc3545;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .footer {
          background: #f8f9fa;
          padding: 20px;
          text-align: center;
          font-size: 14px;
          color: #6c757d;
        }
        .btn {
          display: inline-block;
          padding: 12px 30px;
          background: #667eea;
          color: #ffffff;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>HealthConnect</h1>
          <p>Your Online Doctor Appointment System</p>
        </div>
        
        <div class="content">
          <h2>Hello ${name}!</h2>
          <p>We received a request to ${actionText}. Use the OTP code below to proceed:</p>
          
          <div class="otp-box">
            <p style="margin: 0; font-size: 14px; color: #666;">Your OTP Code</p>
            <div class="otp-code">${otp}</div>
            <p style="margin: 0; font-size: 12px; color: #999;">Valid for 10 minutes</p>
          </div>
          
          <div class="info-box">
            <strong>This OTP will expire in 10 minutes.</strong><br>
            You have 3 attempts to enter the correct OTP.
          </div>
          
          <div class="warning-box">
            <strong>Security Notice:</strong><br>
            • Never share this OTP with anyone<br>
            • HealthConnect will never ask for your OTP via phone or SMS<br>
            • If you didn't request this OTP, please ignore this email
          </div>
          
          <p>If you have any questions or need assistance, feel free to contact our support team.</p>
          
          <p>Best regards,<br>
          <strong>HealthConnect Team</strong></p>
        </div>
        
        <div class="footer">
          <p>© 2025 HealthConnect. All rights reserved.</p>
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Plain text version of OTP email (fallback)
 * @param {String} name - User's name
 * @param {String} otp - 6-digit OTP
 * @param {String} purpose - Purpose of OTP
 * @returns {String} Plain text email
 */
const getOTPEmailPlainText = (name, otp, purpose) => {
  const actionText = purpose === 'registration' ? 'complete your registration' : 'log in to your account';

  return `
Hello ${name}!

We received a request to ${actionText}. Use the OTP code below to proceed:

Your OTP Code: ${otp}

This OTP is valid for 10 minutes and you have 3 attempts to enter it correctly.

SECURITY NOTICE:
• Never share this OTP with anyone
• HealthConnect will never ask for your OTP via phone or SMS
• If you didn't request this OTP, please ignore this email

Best regards,
HealthConnect Team

© 2025 HealthConnect. All rights reserved.
This is an automated email. Please do not reply to this message.
  `;
};

/**
 * Send OTP email
 * @param {Object} options - Email options
 * @param {String} options.email - Recipient email
 * @param {String} options.name - Recipient name
 * @param {String} options.otp - 6-digit OTP
 * @param {String} options.purpose - Purpose (registration/login)
 * @returns {Promise<Object>} { success: Boolean, message: String, info: Object }
 */
export const sendOTPEmail = async ({
  email, name, otp, purpose = 'login',
}) => {
  // Check if transporter is configured
  if (!transporter) {
    console.error('❌ Email service not configured');
    return {
      success: false,
      message: 'Email service not configured. Please contact administrator.',
    };
  }

  const subject = purpose === 'registration'
    ? 'Verify Your Email - HealthConnect Registration'
    : '🔐 Your Login OTP - HealthConnect';

  const mailOptions = {
    from: {
      name: 'HealthConnect',
      address: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    },
    to: email,
    subject,
    html: getOTPEmailTemplate(name, otp, purpose),
    text: getOTPEmailPlainText(name, otp, purpose),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ OTP email sent to ${email}: ${info.messageId}`);

    return {
      success: true,
      message: 'OTP sent successfully',
      info,
    };
  } catch (error) {
    console.error('❌ Error sending OTP email:', error);

    return {
      success: false,
      message: 'Failed to send OTP email. Please try again later.',
      error: error.message,
    };
  }
};

/**
 * Send welcome email after successful registration
 * @param {Object} options - Email options
 * @param {String} options.email - Recipient email
 * @param {String} options.name - Recipient name
 * @param {String} options.role - User role (doctor/patient)
 * @returns {Promise<Object>} { success: Boolean, message: String }
 */
export const sendWelcomeEmail = async ({ email, name, role }) => {
  if (!transporter) {
    return { success: false, message: 'Email service not configured' };
  }

  const roleText = role === 'doctor' ? 'Healthcare Provider' : 'Patient';

  const mailOptions = {
    from: {
      name: 'HealthConnect',
      address: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    },
    to: email,
    subject: '🎉 Welcome to HealthConnect!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏥 Welcome to HealthConnect!</h1>
          </div>
          <div class="content">
            <h2>Hello ${name}! 👋</h2>
            <p>Thank you for registering as a <strong>${roleText}</strong> with HealthConnect.</p>
            <p>Your email has been verified successfully and your account is now active!</p>
            <p>You can now access all features of our platform.</p>
            <p>Best regards,<br><strong>HealthConnect Team</strong></p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true, message: 'Welcome email sent' };
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    return { success: false, message: 'Failed to send welcome email' };
  }
};

/**
 * Send password reset email
 * @param {Object} options - Email options
 * @param {String} options.email - User's email
 * @param {String} options.name - User's name
 * @param {String} options.resetToken - Password reset token
 * @param {String} options.role - User role
 * @returns {Promise<Object>} { success: Boolean, message: String }
 */
export const sendPasswordResetEmail = async ({
  email, name, resetToken, role,
}) => {
  if (!transporter) {
    throw new Error('Email service not configured');
  }

  // Create reset URL
  const resetURL = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background-color: #ffffff;
          border-radius: 10px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .content {
          padding: 40px 30px;
        }
        .content p {
          font-size: 16px;
          margin: 15px 0;
          color: #555;
        }
        .reset-button {
          display: inline-block;
          padding: 15px 40px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white !important;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          margin: 25px 0;
          text-align: center;
          transition: transform 0.2s;
        }
        .reset-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        .reset-link {
          word-break: break-all;
          background-color: #f8f9fa;
          padding: 15px;
          border-radius: 6px;
          font-family: 'Courier New', monospace;
          font-size: 14px;
          color: #666;
          margin: 20px 0;
        }
        .warning {
          background-color: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 15px;
          margin: 25px 0;
          border-radius: 4px;
        }
        .warning-title {
          font-weight: 600;
          color: #856404;
          margin: 0 0 8px 0;
        }
        .warning p {
          margin: 5px 0;
          font-size: 14px;
          color: #856404;
        }
        .footer {
          background-color: #f8f9fa;
          padding: 30px;
          text-align: center;
          color: #666;
          font-size: 14px;
        }
        .footer p {
          margin: 5px 0;
        }
        .expiry-notice {
          background-color: #e3f2fd;
          padding: 12px;
          border-radius: 6px;
          margin: 20px 0;
          text-align: center;
        }
        .expiry-notice strong {
          color: #1976d2;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔒 Password Reset Request</h1>
        </div>
        
        <div class="content">
          <p>Hi <strong>${name}</strong>,</p>
          
          <p>We received a request to reset your password for your <strong>${getRoleDisplay(role)}</strong> account.</p>
          
          <p>Click the button below to reset your password:</p>
          
          <div style="text-align: center;">
            <a href="${resetURL}" class="reset-button">Reset My Password</a>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <div class="reset-link">${resetURL}</div>
          
          <div class="expiry-notice">
            <strong>⏰ This link will expire in 1 hour</strong>
          </div>
          
          <div class="warning">
            <p class="warning-title">⚠️ Security Notice:</p>
            <p>• If you didn't request this password reset, please ignore this email</p>
            <p>• Your current password will remain unchanged</p>
            <p>• Never share this link with anyone</p>
            <p>• We'll never ask for your password via email</p>
          </div>
          
          <p>If you're having trouble clicking the button, you can copy and paste the link into your web browser.</p>
          
          <p>If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>
        </div>
        
        <div class="footer">
          <p><strong>Doctor Appointment System</strong></p>
          <p>This is an automated email, please do not reply.</p>
          <p>If you need help, contact our support team.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"Doctor Appointment System" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Password Reset Request - Doctor Appointment System',
    html: htmlContent,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true, message: 'Password reset email sent' };
  } catch (error) {
    console.error('❌ Error sending password reset email:', error);
    throw new Error('Email service failed. Please try again later.');
  }
};

/**
 * Send password changed confirmation email
 * @param {Object} options - Email options
 * @param {String} options.email - User's email
 * @param {String} options.name - User's name
 * @returns {Promise<Object>} { success: Boolean, message: String }
 */
export const sendPasswordChangedEmail = async ({ email, name }) => {
  if (!transporter) {
    throw new Error('Email service not configured');
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background-color: #ffffff;
          border-radius: 10px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .content {
          padding: 40px 30px;
        }
        .content p {
          font-size: 16px;
          margin: 15px 0;
          color: #555;
        }
        .success-box {
          background-color: #d4edda;
          border-left: 4px solid #28a745;
          padding: 20px;
          margin: 25px 0;
          border-radius: 4px;
          text-align: center;
        }
        .success-icon {
          font-size: 48px;
          margin-bottom: 10px;
        }
        .warning {
          background-color: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 15px;
          margin: 25px 0;
          border-radius: 4px;
        }
        .warning-title {
          font-weight: 600;
          color: #856404;
          margin: 0 0 8px 0;
        }
        .warning p {
          margin: 5px 0;
          font-size: 14px;
          color: #856404;
        }
        .footer {
          background-color: #f8f9fa;
          padding: 30px;
          text-align: center;
          color: #666;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Password Changed Successfully</h1>
        </div>
        
        <div class="content">
          <p>Hi <strong>${name}</strong>,</p>
          
          <div class="success-box">
            <div class="success-icon">🔐</div>
            <p style="margin: 0; font-size: 18px; font-weight: 600; color: #28a745;">
              Your password has been changed successfully!
            </p>
          </div>
          
          <p>Your account password was changed on <strong>${new Date().toLocaleString()}</strong>.</p>
          
          <p>You can now log in with your new password.</p>
          
          <div class="warning">
            <p class="warning-title">⚠️ Didn't make this change?</p>
            <p>If you did NOT change your password, please contact our support team immediately.</p>
            <p>Your account security may be compromised.</p>
          </div>
        </div>
        
        <div class="footer">
          <p><strong>Doctor Appointment System</strong></p>
          <p>This is an automated email, please do not reply.</p>
          <p>If you need help, contact our support team.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"Doctor Appointment System" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Password Changed - Doctor Appointment System',
    html: htmlContent,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true, message: 'Password changed confirmation email sent' };
  } catch (error) {
    console.error('❌ Error sending password changed email:', error);
    // Don't throw error - password was changed successfully, email is just notification
    return { success: false, message: 'Failed to send confirmation email' };
  }
};

/**
 * Send appointment acceptance email to patient
 * @param {Object} options - Email options
 * @param {String} options.patientEmail - Patient's email
 * @param {String} options.patientName - Patient's name
 * @param {String} options.doctorName - Doctor's name
 * @param {String} options.doctorSpecialization - Doctor's specialization
 * @param {String} options.appointmentDate - Appointment date
 * @param {String} options.appointmentTime - Appointment time
 * @returns {Promise<Object>} { success: Boolean, message: String }
 */
export const sendAppointmentAcceptanceEmail = async ({
  patientEmail,
  patientName,
  doctorName,
  doctorSpecialization,
  appointmentDate,
  appointmentTime,
}) => {
  if (!transporter) {
    console.error('❌ Email service not configured');
    return {
      success: false,
      message: 'Email service not configured',
    };
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background: #ffffff;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: #ffffff;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
        }
        .header p {
          margin: 10px 0 0 0;
          font-size: 14px;
          opacity: 0.9;
        }
        .content {
          padding: 40px 30px;
        }
        .greeting {
          font-size: 18px;
          margin-bottom: 20px;
        }
        .success-box {
          background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
          border: 2px solid #28a745;
          border-radius: 8px;
          padding: 25px;
          text-align: center;
          margin: 30px 0;
        }
        .success-icon {
          font-size: 60px;
          margin-bottom: 15px;
          animation: bounce 1s ease infinite;
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .success-message {
          font-size: 20px;
          font-weight: 600;
          color: #155724;
          margin: 0;
        }
        .appointment-card {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-radius: 12px;
          padding: 25px;
          margin: 30px 0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        .appointment-card h3 {
          margin: 0 0 20px 0;
          color: #28a745;
          font-size: 18px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .detail-item {
          display: flex;
          justify-content: space-between;
          padding: 15px;
          margin: 10px 0;
          background: white;
          border-radius: 8px;
          border-left: 4px solid #28a745;
          transition: transform 0.2s;
        }
        .detail-item:hover {
          transform: translateX(5px);
        }
        .detail-label {
          font-weight: 600;
          color: #666;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .detail-value {
          color: #333;
          font-weight: 500;
          text-align: right;
        }
        .info-banner {
          background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
          border: 2px dashed #2196f3;
          border-radius: 8px;
          padding: 20px;
          margin: 25px 0;
        }
        .info-banner h4 {
          margin: 0 0 10px 0;
          color: #1565c0;
          font-size: 16px;
        }
        .info-banner ul {
          margin: 10px 0;
          padding-left: 20px;
          color: #1976d2;
        }
        .info-banner li {
          margin: 8px 0;
          font-size: 14px;
        }
        .footer {
          background: #f8f9fa;
          padding: 30px;
          text-align: center;
          color: #666;
          font-size: 14px;
        }
        .footer p {
          margin: 5px 0;
        }
        .divider {
          height: 2px;
          background: linear-gradient(to right, transparent, #28a745, transparent);
          margin: 30px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏥 HealthConnect</h1>
          <p>Your Online Doctor Appointment System</p>
        </div>
        
        <div class="content">
          <h2 class="greeting">Hello ${patientName}! 👋</h2>
          
          <div class="success-box">
            <div class="success-icon"></div>
            <p class="success-message">Your appointment request has been accepted!</p>
          </div>
          
          <p style="font-size: 16px; color: #555;">Great news! Dr. ${doctorName} has confirmed your appointment. We look forward to your consultation.</p>
          
          <div class="appointment-card">
            <h3>Appointment Details</h3>
            
            <div class="detail-item">
              <span class="detail-label">Doctor :</span>
              <span class="detail-value">Dr. ${doctorName}</span>
            </div>
            
            <div class="detail-item">
              <span class="detail-label">Specialization:</span>
              <span class="detail-value">${doctorSpecialization}</span>
            </div>
            
            <div class="detail-item">
              <span class="detail-label">Date:</span>
              <span class="detail-value">${appointmentDate}</span>
            </div>
            
            <div class="detail-item">
              <span class="detail-label">Time:</span>
              <span class="detail-value">${appointmentTime}</span>
            </div>
          </div>
          
          <div class="info-banner">
            <h4>Important Reminders</h4>
            <ul>
              <li>You will receive a reminder email 15 minutes before your appointment</li>
              <li>Please be available at the scheduled time</li>
  
            </ul>
          </div>
          
          <div class="divider"></div>
          
          <p style="text-align: center; font-size: 16px; color: #555;">
            We look forward to serving you!
          </p>
          
          <p style="text-align: center; margin-top: 20px;">
            Best regards,<br>
            <strong style="color: #28a745;">HealthConnect Team</strong>
          </p>
        </div>
        
        <div class="footer">
          <p><strong>HealthConnect</strong></p>
          <p>Your trusted online healthcare platform</p>
          <p style="margin-top: 15px;">© 2025 HealthConnect. All rights reserved.</p>
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: {
      name: 'HealthConnect',
      address: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    },
    to: patientEmail,
    subject: '✅ Appointment Confirmed - HealthConnect',
    html: htmlContent,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Appointment acceptance email sent to ${patientEmail}: ${info.messageId}`);
    return {
      success: true,
      message: 'Appointment acceptance email sent successfully',
      info,
    };
  } catch (error) {
    console.error('❌ Error sending appointment acceptance email:', error);
    return {
      success: false,
      message: 'Failed to send appointment acceptance email',
      error: error.message,
    };
  }
};

/**
 * Send appointment reminder email to patient (15 minutes before)
 * @param {Object} options - Email options
 * @param {String} options.patientEmail - Patient's email
 * @param {String} options.patientName - Patient's name
 * @param {String} options.doctorName - Doctor's name
 * @param {String} options.doctorSpecialization - Doctor's specialization
 * @param {String} options.appointmentDate - Appointment date
 * @param {String} options.appointmentTime - Appointment time
 * @returns {Promise<Object>} { success: Boolean, message: String }
 */
export const sendAppointmentReminderEmail = async ({
  patientEmail,
  patientName,
  doctorName,
  doctorSpecialization,
  appointmentDate,
  appointmentTime,
}) => {
  if (!transporter) {
    console.error('❌ Email service not configured');
    return {
      success: false,
      message: 'Email service not configured',
    };
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background: #ffffff;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
          color: #ffffff;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
        }
        .header p {
          margin: 10px 0 0 0;
          font-size: 14px;
          opacity: 0.9;
        }
        .content {
          padding: 40px 30px;
        }
        .greeting {
          font-size: 18px;
          margin-bottom: 20px;
        }
        .reminder-box {
          background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
          border: 2px solid #ff9800;
          border-radius: 8px;
          padding: 25px;
          text-align: center;
          margin: 30px 0;
          position: relative;
          overflow: hidden;
        }
        .reminder-box::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(255,152,0,0.1) 0%, transparent 70%);
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
        .reminder-icon {
          font-size: 60px;
          margin-bottom: 15px;
          animation: ring 1s ease-in-out infinite;
          position: relative;
          z-index: 1;
        }
        @keyframes ring {
          0%, 100% { transform: rotate(-10deg); }
          25% { transform: rotate(10deg); }
          50% { transform: rotate(-10deg); }
          75% { transform: rotate(10deg); }
        }
        .reminder-message {
          font-size: 20px;
          font-weight: 600;
          color: #e65100;
          margin: 0;
          position: relative;
          z-index: 1;
        }
        .countdown {
          display: inline-block;
          background: #ff5722;
          color: white;
          padding: 8px 20px;
          border-radius: 20px;
          font-size: 16px;
          font-weight: bold;
          margin-top: 10px;
          position: relative;
          z-index: 1;
        }
        .appointment-card {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-radius: 12px;
          padding: 25px;
          margin: 30px 0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        .appointment-card h3 {
          margin: 0 0 20px 0;
          color: #ff9800;
          font-size: 18px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .detail-item {
          display: flex;
          justify-content: space-between;
          padding: 15px;
          margin: 10px 0;
          background: white;
          border-radius: 8px;
          border-left: 4px solid #ff9800;
          transition: transform 0.2s;
        }
        .detail-item:hover {
          transform: translateX(5px);
        }
        .detail-label {
          font-weight: 600;
          color: #666;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .detail-value {
          color: #333;
          font-weight: 500;
          text-align: right;
        }
        .urgent-banner {
          background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%);
          border: 2px dashed #f44336;
          border-radius: 8px;
          padding: 20px;
          margin: 25px 0;
          text-align: center;
        }
        .urgent-banner h4 {
          margin: 0 0 10px 0;
          color: #c62828;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .urgent-banner p {
          margin: 8px 0;
          color: #d32f2f;
          font-size: 15px;
          font-weight: 500;
        }
        .checklist {
          background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
          border-radius: 8px;
          padding: 20px;
          margin: 25px 0;
        }
        .checklist h4 {
          margin: 0 0 15px 0;
          color: #2e7d32;
          font-size: 16px;
        }
        .checklist-item {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 10px 0;
          color: #388e3c;
          font-size: 14px;
        }
        .checklist-item::before {
          content: '✓';
          background: #4caf50;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          flex-shrink: 0;
        }
        .footer {
          background: #f8f9fa;
          padding: 30px;
          text-align: center;
          color: #666;
          font-size: 14px;
        }
        .footer p {
          margin: 5px 0;
        }
        .divider {
          height: 2px;
          background: linear-gradient(to right, transparent, #ff9800, transparent);
          margin: 30px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏥 HealthConnect</h1>
          <p>Your Online Doctor Appointment System</p>
        </div>
        
        <div class="content">
          <h2 class="greeting">Hello ${patientName}! 👋</h2>
          
          <div class="reminder-box">
            
            <p class="reminder-message">Your appointment is starting soon!</p>
            <div class="countdown">In 15 minutes</div>
          </div>
          
          <p style="font-size: 16px; color: #555; text-align: center;">
            This is a friendly reminder about your upcoming consultation with <strong>Dr. ${doctorName}</strong>.
          </p>
          
          <div class="appointment-card">
            <h3>📋 Appointment Details</h3>
            
            <div class="detail-item">
              <span class="detail-label">Doctor:</span>
              <span class="detail-value">Dr. ${doctorName}</span>
            </div>
            
            <div class="detail-item">
              <span class="detail-label">Specialization:</span>
              <span class="detail-value">${doctorSpecialization}</span>
            </div>
            
            <div class="detail-item">
              <span class="detail-label">Date:</span>
              <span class="detail-value">${appointmentDate}</span>
            </div>
            
            <div class="detail-item">
              <span class="detail-label">Time:</span>
              <span class="detail-value">${appointmentTime}</span>
            </div>
          </div>
          
          <div class="urgent-banner">
            <h4>Please Be Ready!</h4>
            <p>Ensure you are available at the scheduled time</p>
           
          </div>
          
          
          <div class="divider"></div>
          
          <p style="text-align: center; font-size: 16px; color: #555;">
            Thank you for choosing HealthConnect!
          </p>
          
          <p style="text-align: center; margin-top: 20px;">
            Best regards,<br>
            <strong style="color: #ff9800;">HealthConnect Team</strong>
          </p>
        </div>
        
        <div class="footer">
          <p><strong>HealthConnect</strong></p>
          <p>Your trusted online healthcare platform</p>
          <p style="margin-top: 15px;">© 2025 HealthConnect. All rights reserved.</p>
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: {
      name: 'HealthConnect',
      address: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    },
    to: patientEmail,
    subject: '⏰ Appointment Reminder - Starting in 15 Minutes - HealthConnect',
    html: htmlContent,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Appointment reminder email sent to ${patientEmail}: ${info.messageId}`);
    return {
      success: true,
      message: 'Appointment reminder email sent successfully',
      info,
    };
  } catch (error) {
    console.error('❌ Error sending appointment reminder email:', error);
    return {
      success: false,
      message: 'Failed to send appointment reminder email',
      error: error.message,
    };
  }
};

/**
 * Verify email service configuration (for testing)
 * @returns {Promise<Object>} { configured: Boolean, message: String }
 */
export const verifyEmailService = async () => {
  if (!transporter) {
    return {
      configured: false,
      message: 'Email service not configured. Set EMAIL_USER and EMAIL_PASSWORD in .env',
    };
  }

  try {
    await transporter.verify();
    return {
      configured: true,
      message: 'Email service is configured and ready to send emails',
    };
  } catch (error) {
    return {
      configured: false,
      message: `Email service configuration error: ${error.message}`,
    };
  }
};

export default {
  sendOTPEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendAppointmentAcceptanceEmail,
  sendAppointmentReminderEmail,
  verifyEmailService,
};
