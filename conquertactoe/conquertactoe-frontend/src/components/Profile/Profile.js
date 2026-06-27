import React, { useEffect, useState } from 'react';
import { Box, Typography, TextField, Button, Snackbar, Grid } from '@material-ui/core';
import axios from 'axios';
import '../Common/SharedModernStyles.css';
import './Profile.css';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const backendUrl = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // First get current user to get user_id and email
        const userRes = await axios.get(`${backendUrl}/current_user`, { withCredentials: true });
        const userId = userRes.data.user_id;
        const userEmail = userRes.data.email;
        setName(userRes.data.username);

        // Then fetch detailed stats
        const statsRes = await axios.get(`${backendUrl}/leaderboard/player/${userId}`, { withCredentials: true });

        // Merge user data with stats data (stats API doesn't return email)
        setUser({ ...statsRes.data, email: userEmail });
      } catch (error) {
        console.error('Error fetching profile:', error.response?.data || error.message);
      }
    };

    fetchProfile();
  }, [backendUrl]);

  const handleNameChange = async () => {
    try {
      const res = await axios.put(
        `${backendUrl}/users/${user.user_id}`,
        { username: name },
        { withCredentials: true }
      );
      setUser(res.data);
      setEditing(false);
    } catch (error) {
      console.error('Error updating name:', error.response?.data || error.message);
      setError(error.response?.data.error || error.message);
      setOpen(true);
    }
  };

  const handleClose = () => {
    setOpen(false);
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="profile-container modern-container">
      <div className="profile-box">
        <div className="profile-info">
          <div className="user-header">
            <div className="avatar-circle">
              {user.username.substring(0, 2).toUpperCase()}
            </div>
            <div className="user-details-section">
              <div className="user-info-row">
                <div className="user-text-column">
                  {editing ? (
                    <Box className="edit-name">
                      <TextField
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="profile-input"
                        placeholder="Enter your username"
                      />
                      <Box className="button-group">
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={handleNameChange}
                          className="profile-button"
                        >
                          Save
                        </Button>
                        <Button
                          variant="contained"
                          onClick={() => setEditing(false)}
                          className="profile-button"
                        >
                          Cancel
                        </Button>
                      </Box>
                    </Box>
                  ) : (
                    <>
                      <Typography variant="h4" className="username-text">{user.username}</Typography>
                      <Typography variant="subtitle1" className="email-text">{user.email}</Typography>
                    </>
                  )}
                </div>
                {!editing && (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => setEditing(true)}
                    className="profile-button edit-button"
                  >
                    Edit
                  </Button>
                )}
              </div>
            </div>
          </div>

          <Box className="game-stats" mt={4}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <div className="stat-card">
                  <Typography variant="h5" className="stat-card-title">PvP Record</Typography>
                  <div className="stats-content">
                    <div className="stat-row">
                      <span className="stat-label">Games:</span>
                      <span className="stat-value">{user.pvp_total_games || 0}</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Wins:</span>
                      <span className="stat-value">{user.pvp_wins || 0}</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Losses:</span>
                      <span className="stat-value">{user.pvp_losses || 0}</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Draws:</span>
                      <span className="stat-value">{user.pvp_draws || 0}</span>
                    </div>
                  </div>
                  <div className="win-rate-container">
                    <Typography variant="h6" className="win-rate-label">
                      Win Rate
                    </Typography>
                    <div className="progress-bar-container">
                      <div
                        className="progress-bar pvp-progress"
                        style={{ width: `${(user.pvp_win_rate || 0) * 100}%` }}
                      ></div>
                    </div>
                    <Typography variant="h5" className="win-rate-percentage pvp-rate">
                      {((user.pvp_win_rate || 0) * 100).toFixed(1)}%
                    </Typography>
                  </div>
                </div>
              </Grid>

              <Grid item xs={12} md={6}>
                <div className="stat-card">
                  <Typography variant="h5" className="stat-card-title">Bot Record</Typography>
                  <div className="stats-content">
                    <div className="stat-row">
                      <span className="stat-label">Games:</span>
                      <span className="stat-value">{user.bot_total_games || 0}</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Wins:</span>
                      <span className="stat-value">{user.bot_wins || 0}</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Losses:</span>
                      <span className="stat-value">{user.bot_losses || 0}</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Draws:</span>
                      <span className="stat-value">{user.bot_draws || 0}</span>
                    </div>
                  </div>
                  <div className="win-rate-container">
                    <Typography variant="h6" className="win-rate-label">
                      Win Rate
                    </Typography>
                    <div className="progress-bar-container">
                      <div
                        className="progress-bar bot-progress"
                        style={{ width: `${(user.bot_win_rate || 0) * 100}%` }}
                      ></div>
                    </div>
                    <Typography variant="h5" className="win-rate-percentage bot-rate">
                      {((user.bot_win_rate || 0) * 100).toFixed(1)}%
                    </Typography>
                  </div>
                </div>
              </Grid>
            </Grid>
          </Box>
        </div>
      </div>
      <Snackbar
        open={open}
        autoHideDuration={6000}
        onClose={handleClose}
        message={error}
      />
    </div>
  );
};

export default Profile;
