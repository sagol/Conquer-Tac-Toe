import React, { useEffect, useState } from 'react';
import { Container, Box, Typography, TextField, Button, Snackbar } from '@material-ui/core';
import axios from 'axios';
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
        const res = await axios.get(`${backendUrl}/current_user`, { withCredentials: true });
        setUser(res.data);
        setName(res.data.username);
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
    <Container className="profile-container">
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" mt={5}>
        <Box className="profile-box">
          <Box className="profile-info">
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
              <Box className="profile-details">
                <Typography variant="h5" className="username-display">{user.username}</Typography>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => setEditing(true)}
                  className="profile-button"
                >
                  Edit
                </Button>
              </Box>
            )}
            <Typography variant="h6">{user.email}</Typography>
          </Box>
          <Box className="game-stats">
            <Typography variant="h6"><strong>Games Played:</strong> {user.games_played}</Typography>
            <Typography variant="h6"><strong>Wins:</strong> {user.wins}</Typography>
            <Typography variant="h6"><strong>Losses:</strong> {user.losses}</Typography>
            <Typography variant="h6"><strong>Draws:</strong> {user.draws}</Typography>
          </Box>
        </Box>
      </Box>
      <Snackbar
        open={open}
        autoHideDuration={6000}
        onClose={handleClose}
        message={error}
      />
    </Container>
  );
};

export default Profile;
