import React, { useState } from 'react';
import { Button, Container, Box, TextField, Typography } from '@material-ui/core';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchCurrentUser } from '../../redux/actions/authActions';

const Login = () => {
  const [username, setUsername] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3000';

  const handleGoogleLogin = () => {
    window.location.href = `${backendUrl}/auth/google`;
  };

  const handleDevLogin = async () => {
    try {
      await axios.post(`${backendUrl}/auth/dev_login`, { username }, { withCredentials: true });
      await dispatch(fetchCurrentUser()); // Update Redux state
      navigate('/'); // Navigate to home
    } catch (error) {
      console.error('Dev login failed:', error);
      alert('Dev login failed');
    }
  };

  return (
    <Container>
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="100vh">
        <Typography variant="h4" gutterBottom>Login</Typography>

        <Button variant="contained" color="primary" onClick={handleGoogleLogin} style={{ marginBottom: '20px' }}>
          Login with Google
        </Button>

        <Box mt={4} p={3} border={1} borderColor="grey.300" borderRadius={4}>
          <Typography variant="h6" gutterBottom>Dev Login</Typography>
          <TextField
            label="Username"
            variant="outlined"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ marginBottom: '10px' }}
          />
          <br />
          <Button variant="contained" color="secondary" onClick={handleDevLogin}>
            Dev Login
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default Login;
