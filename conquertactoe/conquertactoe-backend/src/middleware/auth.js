module.exports.ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  } else {
    res.status(401).json({ error: 'User not authenticated' });
  }
};

module.exports.ensureAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user && req.user.role === 'admin') {
    return next();
  } else {
    res.status(403).json({ error: 'Admin access required' });
  }
};
