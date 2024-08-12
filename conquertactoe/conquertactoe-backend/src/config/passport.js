const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const pool = require('../config/db');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const res = await pool.query('SELECT * FROM Users WHERE oauth_id = $1', [profile.id]);
    if (res.rows.length === 0) {
      // Check if the username already exists
      const existingUserRes = await pool.query('SELECT * FROM Users WHERE username = $1', [profile.displayName]);
      let username = profile.displayName;
      
      if (existingUserRes.rows.length > 0) {
        // Generate a unique username if it already exists
        username = `${profile.displayName}-${profile.id}`;
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
