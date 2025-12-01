import React, { useState, useEffect } from 'react';
import { Button, Box, TextField, Typography } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchCurrentUser } from '../../redux/actions/authActions';
import '../Common/SharedModernStyles.css';
import './Login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [config, setConfig] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3000';

  // Fetch public configs on component mount
  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const response = await axios.get(`${backendUrl}/api/config/public`);
        setConfig(response.data);
      } catch (error) {
        console.error('Failed to fetch configs:', error);
        setConfig({}); // Use empty config on error
      }
    };
    fetchConfigs();
  }, [backendUrl]);

  const handleGoogleLogin = () => {
    window.location.href = `${backendUrl}/auth/google`;
  };

  const handleDevLogin = async () => {
    try {
      setErrorMessage(''); // Clear previous errors
      await axios.post(`${backendUrl}/auth/dev_login`, { username }, { withCredentials: true });
      await dispatch(fetchCurrentUser()); // Update Redux state
      navigate('/'); // Navigate to home
    } catch (error) {
      console.error('Dev login failed:', error);

      // Check if user is banned
      if (error.response?.status === 403 && error.response?.data?.banned) {
        const { reason, expiresAt } = error.response.data;
        const encodedReason = encodeURIComponent(reason || 'Violation of terms of service');
        const encodedExpires = encodeURIComponent(expiresAt || 'Permanent');
        navigate(`/banned?reason=${encodedReason}&expires=${encodedExpires}`);
      } else if (error.response?.status === 403 && error.response?.data?.error === 'New registrations are currently disabled') {
        // Show banner for disabled registrations
        setErrorMessage(error.response.data.error);
      } else {
        setErrorMessage(error.response?.data?.error || 'Dev login failed. Please try again.');
      }
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form-box">
        <Typography variant="h2" className="modern-title">Login</Typography>

        {/* Show error banner if there's an error */}
        {errorMessage && (
          <Box mb={2}>
            <Alert severity="warning" onClose={() => setErrorMessage('')}>
              {errorMessage}
            </Alert>
          </Box>
        )}

        {/* Show info banner if registrations are disabled */}
        {config.new_registrations === 'false' && (
          <Box mb={2}>
            <Alert severity="info">
              New user registrations are currently disabled. Please check back later or contact support.
            </Alert>
          </Box>
        )}

        <Button
          variant="contained"
          className="google-login-button"
          onClick={handleGoogleLogin}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" style={{ marginRight: '10px' }}>
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Login with Google
        </Button>

        {/* Conditionally render Dev Login section */}
        {config.ENABLE_DEV_LOGIN === 'true' && (
          <>
            <div className="auth-link">
              <Typography variant="body1">
                Or use developer login below
              </Typography>
            </div>

            <Box mt={3}>
              <TextField
                placeholder="Enter your username"
                variant="outlined"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <Button
                variant="contained"
                color="secondary"
                onClick={handleDevLogin}
                fullWidth
              >
                Dev Login
              </Button>
            </Box>
          </>
        )}
      </div>
    </div>
  );
};

export default Login;
