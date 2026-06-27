const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const pool = require('../config/db');
const { isValidUsername } = require('../utils/validation');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const res = await pool.query('SELECT * FROM Users WHERE oauth_id = $1', [profile.id]);
    if (res.rows.length === 0) {
      // Sanitize the Google display name to our allowed username charset.
      let baseName = profile.displayName;
      if (!isValidUsername(baseName)) {
        baseName = baseName.replace(/[^a-zA-Z0-9_ -]/g, '').trim();
        if (!baseName) baseName = `user-${profile.id}`;
      }

      // Check if the username already exists
      const existingUserRes = await pool.query('SELECT * FROM Users WHERE username = $1', [baseName]);
      let username = baseName;

      if (existingUserRes.rows.length > 0) {
        // Generate a unique username if it already exists
        username = `${baseName}-${profile.id}`;
      }

      const newUser = await pool.query('INSERT INTO Users (oauth_id, username, email) VALUES ($1, $2, $3) RETURNING *',
        [profile.id, username, profile.emails[0].value]);
      done(null, newUser.rows[0]);
    } else {
      done(null, res.rows[0]);
    }
  } catch (err) {
    done(err, null);
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
