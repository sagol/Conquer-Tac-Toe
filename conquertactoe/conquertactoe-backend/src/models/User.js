const pool = require('../config/db');

const User = {
  findByOAuthId: async (oauthId) => {
    console.log('Finding user by OAuth ID:', oauthId);
    const result = await pool.query('SELECT * FROM Users WHERE oauth_id = $1', [oauthId]);
    return result.rows[0];
  },

  create: async (oauthId, username, email, token) => {
    console.log('Creating new user with OAuth ID:', oauthId);
    const result = await pool.query(
      'INSERT INTO Users (oauth_id, username, email, token) VALUES ($1, $2, $3, $4) RETURNING *',
      [oauthId, username, email, token]
    );
    return result.rows[0];
  },

  findById: async (userId) => {
    console.log('Finding user by ID:', userId);
    const result = await pool.query('SELECT * FROM Users WHERE user_id = $1', [userId]);
    return result.rows[0];
  },

  updateToken: async (userId, token) => {
    console.log('Updating token for user ID:', userId);
    await pool.query('UPDATE Users SET token = $1 WHERE user_id = $2', [token, userId]);
  },

  findOrCreate: async (profile, token) => {
    console.log('findOrCreate with profile:', profile);
    let user = await User.findByOAuthId(profile.id);
    if (!user) {
      user = await User.create(profile.id, profile.displayName, profile.emails[0].value, token);
    } else {
      user.token = token;
      await User.updateToken(user.user_id, token);
    }
    console.log('User in findOrCreate:', user);
    return user;
  },

  getStatsById: async (userId) => {
    console.log(`Querying stats for user ID: ${userId}`);
    const result = await pool.query(
      'SELECT wins, losses, draws FROM Users WHERE user_id = $1',
      [userId]
    );

    console.log('Stats query result:', result.rows[0]);
    return result.rows[0];
  },
};

module.exports = User;
