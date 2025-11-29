import React from 'react';
import { Container, Typography, Paper, Box } from '@material-ui/core';
import BuildIcon from '@material-ui/icons/Build';
import './Maintenance.css';

const Maintenance = () => {
    return (
        <div className="maintenance-container">
            <Container maxWidth="sm">
                <Paper elevation={6} className="maintenance-card">
                    <Box className="maintenance-icon-container">
                        <BuildIcon className="maintenance-icon" />
                    </Box>

                    <Typography variant="h3" className="maintenance-title">
                        Under Maintenance
                    </Typography>

                    <Typography variant="body1" className="maintenance-subtitle">
                        We're currently performing scheduled maintenance to improve your experience
                    </Typography>

                    <Box className="maintenance-info-box">
                        <Typography variant="body2" className="maintenance-message">
                            Our team is working hard to bring you new features and improvements.
                            We'll be back online shortly!
                        </Typography>
                    </Box>

                    <Typography variant="body2" className="maintenance-footer">
                        Thank you for your patience
                    </Typography>
                </Paper>
            </Container>
        </div>
    );
};

export default Maintenance;
