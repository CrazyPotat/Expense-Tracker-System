
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();

const EMAILJS_SERVICE_ID = 'service_0ct7bjq';
const EMAILJS_TEMPLATE_ID = 'template_ouwo0c9';

const OTP_EXPIRY_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 5;

function hashOtp(otp) {
    return crypto
        .createHash('sha256')
        .update(otp)
        .digest('hex');
}

// REGISTER: Send OTP; do not create the user yet.
router.post('/register', async (req, res) => {
    try {
        const { full_name, email, password } = req.body;

        if (
            typeof full_name !== 'string' ||
            typeof email !== 'string' ||
            typeof password !== 'string' ||
            !full_name.trim() ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                message: 'Name, email, and password are required.'
            });
        }

        const normalizedName = full_name.trim();
        const normalizedEmail = email.trim().toLowerCase();

        if (password.length < 8) {
            return res.status(400).json({
                message: 'Password must be at least 8 characters.'
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return res.status(400).json({
                message: 'Please enter a valid email address.'
            });
        }

        if (!process.env.EMAILJS_PUBLIC_KEY) {
            console.error('EMAILJS_PUBLIC_KEY is missing.');

            return res.status(500).json({
                message: 'Email verification is not configured on the server.'
            });
        }

        const [existingUsers] = await db.query(
            'SELECT id FROM users WHERE email = ?',
            [normalizedEmail]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                message: 'Email already registered. Please log in.'
            });
        }

        const otp = crypto.randomInt(0, 1000000)
            .toString()
            .padStart(6, '0');

        const otpHash = hashOtp(otp);
        const passwordHash = await bcrypt.hash(password, 10);
        const expiresAt = new Date(
            Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
        );

        // Save pending verification, not a user account.
        await db.query(
            `INSERT INTO pending_email_verifications
                (full_name, email, password_hash, otp_hash,
                 expires_at, attempts)
             VALUES (?, ?, ?, ?, ?, 0)
             ON DUPLICATE KEY UPDATE
                full_name = VALUES(full_name),
                password_hash = VALUES(password_hash),
                otp_hash = VALUES(otp_hash),
                expires_at = VALUES(expires_at),
                attempts = 0`,
            [
                normalizedName,
                normalizedEmail,
                passwordHash,
                otpHash,
                expiresAt
            ]
        );

        let emailResponse;

        try {
            emailResponse = await fetch(
                'https://api.emailjs.com/api/v1.0/email/send',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        service_id: EMAILJS_SERVICE_ID,
                        template_id: EMAILJS_TEMPLATE_ID,
                        user_id: process.env.EMAILJS_PUBLIC_KEY,
                        template_params: {
                            to_email: normalizedEmail,
                            user_name: normalizedName,
                            otp_code: otp
                        }
                    })
                }
            );
        } catch (emailError) {
            console.error('EmailJS request failed:', emailError.message);

            await db.query(
                'DELETE FROM pending_email_verifications WHERE email = ?',
                [normalizedEmail]
            );

            return res.status(502).json({
                message: 'Unable to send verification email. Please try again.'
            });
        }

        if (!emailResponse.ok) {
            const emailError = await emailResponse.text();

            console.error('EmailJS error:', emailError);

            await db.query(
                'DELETE FROM pending_email_verifications WHERE email = ?',
                [normalizedEmail]
            );

            return res.status(502).json({
                message: 'Unable to send verification email. Please check the email configuration.'
            });
        }

        return res.status(200).json({
            message: 'OTP sent to your email. Please verify within 5 minutes.',
            email: normalizedEmail,
            requiresOtp: true
        });
    } catch (error) {
        console.error('Register error:', error.message);

        return res.status(500).json({
            message: 'Server error during registration.'
        });
    }
});

// VERIFY OTP: Create the user only after successful verification.
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (
            typeof email !== 'string' ||
            typeof otp !== 'string' ||
            !email.trim() ||
            !/^\d{6}$/.test(otp)
        ) {
            return res.status(400).json({
                message: 'A valid email and 6-digit OTP are required.'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const [pendingRows] = await db.query(
            `SELECT full_name, email, password_hash, otp_hash,
                    expires_at, attempts
             FROM pending_email_verifications
             WHERE email = ?`,
            [normalizedEmail]
        );

        if (pendingRows.length === 0) {
            return res.status(400).json({
                message: 'No pending verification found. Please register again.'
            });
        }

        const pending = pendingRows[0];

        if (Number(pending.attempts) >= MAX_OTP_ATTEMPTS) {
            await db.query(
                'DELETE FROM pending_email_verifications WHERE email = ?',
                [normalizedEmail]
            );

            return res.status(429).json({
                message: 'Too many incorrect attempts. Please register again.'
            });
        }

        const expiryTime = new Date(pending.expires_at).getTime();

        if (!Number.isFinite(expiryTime) || Date.now() >= expiryTime) {
            await db.query(
                'DELETE FROM pending_email_verifications WHERE email = ?',
                [normalizedEmail]
            );

            return res.status(400).json({
                message: 'OTP expired. Please register again.'
            });
        }

        const submittedHash = hashOtp(otp);
        const savedHash = String(pending.otp_hash);

        const validOtp =
            /^[a-f0-9]{64}$/i.test(savedHash) &&
            crypto.timingSafeEqual(
                Buffer.from(submittedHash, 'hex'),
                Buffer.from(savedHash, 'hex')
            );

        if (!validOtp) {
            await db.query(
                `UPDATE pending_email_verifications
                 SET attempts = attempts + 1
                 WHERE email = ?`,
                [normalizedEmail]
            );

            return res.status(400).json({
                message: 'Incorrect OTP. Please try again.'
            });
        }

        // Recheck before inserting to prevent duplicate accounts.
        const [existingUsers] = await db.query(
            'SELECT id FROM users WHERE email = ?',
            [normalizedEmail]
        );

        if (existingUsers.length > 0) {
            await db.query(
                'DELETE FROM pending_email_verifications WHERE email = ?',
                [normalizedEmail]
            );

            return res.status(409).json({
                message: 'Email already registered. Please log in.'
            });
        }

        const [result] = await db.query(
            `INSERT INTO users (full_name, email, password, role)
             VALUES (?, ?, ?, ?)`,
            [
                pending.full_name,
                normalizedEmail,
                pending.password_hash,
                'user'
            ]
        );

        await db.query(
            'DELETE FROM pending_email_verifications WHERE email = ?',
            [normalizedEmail]
        );

        return res.status(201).json({
            message: 'Email verified and registration successful!',
            user: {
                id: result.insertId,
                full_name: pending.full_name,
                email: normalizedEmail,
                role: 'user'
            }
        });
    } catch (error) {
        console.error('OTP verification error:', error.message);

        return res.status(500).json({
            message: 'Server error during OTP verification.'
        });
    }
});

// LOGIN: OTP is not required for every login.
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== 'string' ||
            typeof password !== 'string' ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                message: 'Email and password are required.'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const [users] = await db.query(
            `SELECT id, full_name, email, password, role
             FROM users
             WHERE email = ?`,
            [normalizedEmail]
        );

        if (users.length === 0) {
            return res.status(401).json({
                message: 'Invalid email or password.'
            });
        }

        const user = users[0];

        const passwordMatches = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatches) {
            return res.status(401).json({
                message: 'Invalid email or password.'
            });
        }

        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET is missing.');

            return res.status(500).json({
                message: 'Server authentication configuration error.'
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        return res.json({
            message: 'Login successful!',
            token,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error.message);

        return res.status(500).json({
            message: 'Server error during login.'
        });
    }
});

module.exports = router;
