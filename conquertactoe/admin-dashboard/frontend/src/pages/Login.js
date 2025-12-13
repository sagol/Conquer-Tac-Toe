import React, { useState, useEffect } from 'react';
import { Box, Button, TextField, Typography, Paper, Alert, Tooltip, Divider } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import GoogleIcon from '@mui/icons-material/Google';
import api from '../api';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [enableDevLogin, setEnableDevLogin] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        // Fetch auth config
        const fetchConfig = async () => {
            try {
                const res = await api.get('/auth/config');
                setEnableDevLogin(res.data.enableDevLogin);
            } catch (err) {
                console.error('Failed to fetch auth config:', err);
                // Default to false if failed
                setEnableDevLogin(false);
            }
        };
        fetchConfig();

        // Check for OAuth success on redirect
        const params = new URLSearchParams(location.search);
        console.log('Login Page Loaded. Search Params:', location.search);

        if (params.get('auth') === 'success') {
            const token = params.get('token');
            console.log('Auth success detected. Token present:', !!token);

            if (token) {
                // Store the JWT token from the URL
                localStorage.setItem('adminToken', token);
                console.log('Token stored in localStorage');

                // Clear URL params to keep it clean
                window.history.replaceState({}, document.title, "/");
                navigate('/');
            } else {
                console.error('No token found in URL despite auth=success');
                setError('OAuth successful but no token received.');
            }
        } else if (params.get('error') === 'oauth_failed') {
            console.error('OAuth failed error param detected');
            setError('OAuth authentication failed. Email may not be authorized.');
        } else if (params.get('error') === 'server_error') {
            console.error('Server error param detected');
            setError('Server error during login.');
        }
    }, [location, navigate]);

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/auth/login', { email, password });
            localStorage.setItem('adminToken', res.data.token);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.error || 'Invalid credentials');
        }
    };

    const handleGoogleLogin = () => {
        // Redirect to backend OAuth route
        const apiUrl = process.env.REACT_APP_ADMIN_API_URL || 'http://localhost:4000/admin';
        window.location.href = `${apiUrl}/auth/google`;
    };

    return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" bgcolor="#f5f5f5">
            <Paper elevation={3} sx={{ p: 4, width: 350 }}>
                <Typography variant="h5" gutterBottom align="center">Admin Login</Typography>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                {enableDevLogin && (
                    <>
                        <form onSubmit={handleLogin}>
                            <TextField
                                fullWidth
                                label="Email"
                                margin="normal"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                            <TextField
                                fullWidth
                                label="Password"
                                type="password"
                                margin="normal"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <Button
                                fullWidth
                                variant="contained"
                                color="primary"
                                type="submit"
                                sx={{ mt: 2 }}
                            >
                                Login
                            </Button>
                        </form>

                        <Divider sx={{ my: 3 }}>OR</Divider>
                    </>
                )}

                <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<GoogleIcon />}
                    onClick={handleGoogleLogin}
                    sx={{
                        borderColor: '#4285f4',
                        color: '#4285f4',
                        '&:hover': {
                            borderColor: '#357ae8',
                            backgroundColor: 'rgba(66, 133, 244, 0.04)'
                        }
                    }}
                >
                    Sign in with Google
                </Button>
            </Paper>
        </Box>
    );
};

export default Login;
