const passport = require('passport');
const pool = require('../config/db');
const { getBooleanSetting } = require('../utils/settings');

// Returns true if the user is still banned. Clears the ban first if it has expired.
async function isStillBanned(user) {
  if (!user.is_banned) return false;
  const expired = user.ban_expires_at && new Date(user.ban_expires_at) < new Date();
  if (!expired) return true;
  try {
    await pool.query('UPDATE Users SET is_banned = FALSE, ban_expires_at = NULL, ban_reason = NULL WHERE user_id = $1', [user.user_id]);
    user.is_banned = false;
  } catch (dbErr) {
    console.error('Error unbanning user:', dbErr);
  }
  return false;
}

exports.googleAuth = passport.authenticate('google', { scope: ['profile', 'email'] });

exports.googleAuthCallback = (req, res, next) => {
  passport.authenticate('google', async (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.redirect('/login');
    }

    if (await isStillBanned(user)) {
      const reason = encodeURIComponent(user.ban_reason || 'Violation of terms');
      const expires = encodeURIComponent(user.ban_expires_at ? new Date(user.ban_expires_at).toISOString() : 'Permanent');
      return res.redirect(`${process.env.CLIENT_URL}/banned?reason=${reason}&expires=${expires}`);
    }

    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      return res.redirect(`${process.env.CLIENT_URL}/profile`);
    });
  })(req, res, next);
};

exports.logout = (req, res, next) => {
  req.logout((err) => {
    if (err) { return next(err); }
    res.set('Access-Control-Allow-Origin', process.env.CLIENT_URL);
    res.set('Access-Control-Allow-Credentials', 'true');
    res.status(200).json({ message: 'Logged out' });
  });
};

exports.currentUser = async (req, res) => {
  console.log("Current User Endpoint Called");

  if (!req.user) {
    return res.json(null);
  }

  // Check if user is banned (in case they were banned while logged in)
  if (await isStillBanned(req.user)) {
    // Still banned, log them out
    req.logout(() => {
      return res.status(403).json({
        error: 'Account banned',
        reason: req.user.ban_reason,
        expires: req.user.ban_expires_at
      });
    });
    return;
  }

  console.log("User Info:", req.user);
  res.json(req.user);
};

exports.devLogin = async (req, res, next) => {
  console.log('devLogin called with body:', req.body);
  const { username } = req.body;
  if (!username) {
    console.log('Username missing');
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    // Check if user exists
    console.log('Checking for user:', username);
    let userRes = await pool.query('SELECT * FROM Users WHERE username = $1', [username]);
    let user = userRes.rows[0];

    if (!user) {
      console.log('User not found, creating new user');

      // Check if new registrations are allowed
      const allowNewRegistrations = await getBooleanSetting('new_registrations', true);
      if (!allowNewRegistrations) {
        console.log('New registrations are currently disabled');
        return res.status(403).json({ error: 'New registrations are currently disabled' });
      }

      // Create new user if not exists
      const oauthId = `dev_${username}`;
      const email = `${username}@dev.com`;
      const newUserRes = await pool.query(
        'INSERT INTO Users (oauth_id, username, email) VALUES ($1, $2, $3) RETURNING *',
        [oauthId, username, email]
      );
      user = newUserRes.rows[0];
    }

    if (await isStillBanned(user)) {
      return res.status(403).json({
        banned: true,
        error: 'Account banned',
        reason: user.ban_reason || 'Violation of terms of service',
        expiresAt: user.ban_expires_at || 'Permanent'
      });
    }

    console.log('Logging in user:', user);
    // Log the user in
    req.logIn(user, async (err) => {
      if (err) {
        console.error('req.logIn error:', err);
        return next(err);
      }

      // Set session timeout based on setting
      const { getNumberSetting } = require('../utils/settings');
      const timeoutMinutes = await getNumberSetting('session_timeout_minutes', 60);
      req.session.cookie.maxAge = timeoutMinutes * 60 * 1000;

      console.log(`Login successful. Session timeout set to ${timeoutMinutes} minutes.`);
      return res.json(user);
    });
  } catch (err) {
    console.error('Dev login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
