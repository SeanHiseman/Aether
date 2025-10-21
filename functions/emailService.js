import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
 
const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 465,
    secure: true,
    auth: {
        user: process.env.BREVO_SMTP_USER, 
        pass: process.env.BREVO_SMTP_KEY   
    }
});

export const generateVerificationToken = (userId, email) => {
    return jwt.sign(
        { userId, email, type: 'email_verification' },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );
};

export const sendVerificationEmail = async (email, username, verificationToken) => {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    const mailOptions = {
        from: '"Aether" <no-reply@aethersocial.com>',
        to: email,
        subject: 'Verify your email',
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Welcome to Aether Social, ${username}!</h2>
            <p>Thanks for signing up. Please verify your email address by clicking the link below:</p>
            <div style="margin: 30px 0;">
            <a href="${verificationUrl}" 
                style="background-color: #4CAF50; color: white; padding: 12px 30px; 
                        text-decoration: none; border-radius: 5px; display: inline-block;">
                Verify Email Address
            </a>
            </div>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
            <p>This link will expire in 24 hours.</p>
            <hr style="border: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">
            If you didn't create an account on Aether Social, you can safely ignore this email.
            </p>
        </div>
        `,
        text: `
        Welcome to Aether Social, ${username}!
        
        Please verify your email address by visiting this link:
        ${verificationUrl}
        
        This link will expire in 24 hours.
        
        If you didn't create an account on Aether Social, you can safely ignore this email.
        `
    };
    return transporter.sendMail(mailOptions);
};

export const sendPasswordResetEmail = async (email, username, resetToken) => {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const mailOptions = {
        from: `"Aether" <no-reply@aether.cool>`,
        to: email,
        subject: 'Reset your Aether Social password',
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p>Hi ${username},</p>
            <p>We received a request to reset your password. Click the link below to create a new password:</p>
            <div style="margin: 30px 0;">
            <a href="${resetUrl}" 
                style="background-color: #FF5722; color: white; padding: 12px 30px; 
                        text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
            </a>
            </div>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all; color: #666;">${resetUrl}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request a password reset, you can safely ignore this email.</p>
        </div>
        `
    };
    return transporter.sendMail(mailOptions);
};