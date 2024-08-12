const passport = require('passport');

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
