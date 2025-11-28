import React from 'react';
import { useLocation } from 'react-router-dom';
import { Container, Typography, Paper, Box, Button } from '@material-ui/core';
import BlockIcon from '@material-ui/icons/Block';

const Banned = () => {
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const reason = searchParams.get('reason');
    const expires = searchParams.get('expires');

    const formatDate = (dateString) => {
        if (!dateString || dateString === 'Permanent') return 'Permanent';
        return new Date(dateString).toLocaleString();
    };

    return (
        <Container maxWidth="sm" sx={{ mt: 8 }}>
            <Paper elevation={3} sx={{ p: 4, textAlign: 'center', bgcolor: '#fff0f0' }}>
                <BlockIcon sx={{ fontSize: 60, color: 'error.main', mb: 2 }} />
                <Typography variant="h4" color="error" gutterBottom>
                    Account Suspended
                </Typography>
                <Typography variant="body1" paragraph>
                    Your account has been suspended due to a violation of our terms of service.
                </Typography>

                <Box sx={{ my: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid #ffcdd2' }}>
                    <Typography variant="subtitle2" color="textSecondary">
                        Reason:
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                        {reason || 'No reason provided'}
                    </Typography>

                    <Typography variant="subtitle2" color="textSecondary" sx={{ mt: 2 }}>
                        Suspension expires:
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                        {formatDate(expires)}
                    </Typography>
                </Box>

                <Typography variant="body2" color="textSecondary" paragraph>
                    If you believe this is a mistake, please contact support.
                </Typography>

                <Button variant="outlined" color="primary" href="/login">
                    Back to Login
                </Button>
            </Paper>
        </Container>
    );
};

export default Banned;
