const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Parse allowed admin emails from environment variable
const getAllowedEmails = () => {
    const emails = process.env.ADMIN_ALLOWED_EMAILS || '';
    return emails.split(',').map(email => email.trim()).filter(email => email.length > 0);
};

passport.use('google-admin', new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "/admin/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails[0].value;
        const allowedEmails = getAllowedEmails();

        console.log('OAuth attempt for email:', email);
        console.log('Allowed emails:', allowedEmails);

        // Check if email is in allowed list
        if (!allowedEmails.includes(email)) {
            console.log('Email not in allowlist!');
            return done(null, false, { message: 'Email not authorized for admin access' });
        }

        console.log('Email authorized, proceeding with user creation/lookup');

        // Check if user exists by OAuth ID
        const res = await pool.query('SELECT * FROM Users WHERE oauth_id = $1', [profile.id]);

        if (res.rows.length === 0) {
            // Check if user exists by email
            const emailRes = await pool.query('SELECT * FROM Users WHERE email = $1', [email]);

            if (emailRes.rows.length > 0) {
                // User exists with this email, update with OAuth ID and set role to admin
                const updatedUser = await pool.query(
                    'UPDATE Users SET oauth_id = $1, role = $2 WHERE email = $3 RETURNING *',
                    [profile.id, 'admin', email]
                );
                return done(null, updatedUser.rows[0]);
            } else {
                // Create new user with admin role
                const username = profile.displayName || email.split('@')[0];
                const newUser = await pool.query(
                    'INSERT INTO Users (oauth_id, username, email, role) VALUES ($1, $2, $3, $4) RETURNING *',
                    [profile.id, username, email, 'admin']
                );
                return done(null, newUser.rows[0]);
            }
        } else {
            // User exists, ensure they have admin role
            const user = res.rows[0];
            if (user.role !== 'admin' && user.role !== 'super_admin') {
                await pool.query('UPDATE Users SET role = $1 WHERE user_id = $2', ['admin', user.user_id]);
                user.role = 'admin';
            }
            return done(null, user);
        }
    } catch (err) {
        console.error('OAuth error:', err);
        return done(err, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.user_id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const res = await pool.query('SELECT * FROM Users WHERE user_id = $1', [id]);
        done(null, res.rows[0]);
    } catch (err) {
        done(err, null);
    }
});

module.exports = passport;
