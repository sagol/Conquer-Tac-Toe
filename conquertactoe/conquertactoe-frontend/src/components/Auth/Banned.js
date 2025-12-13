import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Container, Typography, Paper, Box, Button } from '@material-ui/core';
import BlockIcon from '@material-ui/icons/Block';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import './Banned.css';

const Banned = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const searchParams = new URLSearchParams(location.search);
    const reason = searchParams.get('reason') || 'Violation of terms of service';
    const expiresParam = searchParams.get('expires');

    const [timeRemaining, setTimeRemaining] = useState(null);
    const isPermanent = !expiresParam || expiresParam === 'Permanent';
    const expiryDate = !isPermanent ? new Date(expiresParam) : null;

    useEffect(() => {
        if (isPermanent) return;

        const updateTimer = () => {
            const now = new Date();
            const diff = expiryDate - now;

            if (diff <= 0) {
                // Ban expired, redirect to login
                navigate('/login');
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            setTimeRemaining({ days, hours, minutes, seconds });
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [isPermanent, expiryDate, navigate]);

    const formatDate = (date) => {
        if (!date) return 'Permanent';
        return date.toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="auth-container banned-container">
            <Container maxWidth="sm" style={{ marginTop: '80px' }}>
                <Paper elevation={6} className="banned-card">
                    <Box className="banned-icon-container">
                        <BlockIcon className="banned-icon" />
                    </Box>

                    <Typography variant="h3" className="banned-title">
                        Account Suspended
                    </Typography>

                    <Typography variant="body1" className="banned-subtitle">
                        Your account has been temporarily suspended
                    </Typography>

                    <Box className="banned-info-box">
                        <Typography variant="subtitle2" className="banned-label">
                            Reason for suspension:
                        </Typography>
                        <Typography variant="body1" className="banned-reason">
                            {reason}
                        </Typography>

                        {!isPermanent && timeRemaining && (
                            <>
                                <Box className="timer-container">
                                    <AccessTimeIcon className="timer-icon" />
                                    <Typography variant="h6" className="timer-label">
                                        Time Remaining
                                    </Typography>
                                </Box>

                                <Box className="countdown-container">
                                    {timeRemaining.days > 0 && (
                                        <div className="countdown-unit">
                                            <span className="countdown-value">{timeRemaining.days}</span>
                                            <span className="countdown-label">Days</span>
                                        </div>
                                    )}
                                    <div className="countdown-unit">
                                        <span className="countdown-value">{timeRemaining.hours}</span>
                                        <span className="countdown-label">Hours</span>
                                    </div>
                                    <div className="countdown-unit">
                                        <span className="countdown-value">{timeRemaining.minutes}</span>
                                        <span className="countdown-label">Minutes</span>
                                    </div>
                                    <div className="countdown-unit">
                                        <span className="countdown-value">{timeRemaining.seconds}</span>
                                        <span className="countdown-label">Seconds</span>
                                    </div>
                                </Box>

                                <Typography variant="body2" className="expiry-date">
                                    Ban expires: {formatDate(expiryDate)}
                                </Typography>
                            </>
                        )}

                        {isPermanent && (
                            <Typography variant="h6" className="permanent-ban">
                                This is a permanent suspension
                            </Typography>
                        )}
                    </Box>

                    <Typography variant="body2" className="support-text">
                        If you believe this is a mistake, please contact support
                    </Typography>

                    <Button
                        variant="contained"
                        className="back-button"
                        onClick={() => navigate('/login')}
                    >
                        Back to Login
                    </Button>
                </Paper>
            </Container>
        </div>
    );
};

export default Banned;
