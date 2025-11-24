const passport = require('passport');
const pool = require('../config/db');

exports.googleAuth = passport.authenticate('google', { scope: ['profile', 'email'] });

exports.googleAuthCallback = (req, res, next) => {
  passport.authenticate('google', (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.redirect('/login');
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

exports.currentUser = (req, res) => {
  console.log("Current User Endpoint Called");
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
      // Create new user if not exists
      const oauthId = `dev_${username}`;
      const email = `${username}@dev.com`;
      const newUserRes = await pool.query(
        'INSERT INTO Users (oauth_id, username, email) VALUES ($1, $2, $3) RETURNING *',
        [oauthId, username, email]
      );
      user = newUserRes.rows[0];
    }

    console.log('Logging in user:', user);
    // Log the user in
    req.logIn(user, (err) => {
      if (err) {
        console.error('req.logIn error:', err);
        return next(err);
      }
      console.log('Login successful');
      return res.json(user);
    });
  } catch (err) {
    console.error('Dev login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
