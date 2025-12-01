import React, { useEffect, useState } from 'react';
import { Grid, Paper, Typography, Box } from '@mui/material';
import api from '../api';

const Dashboard = () => {
    const [health, setHealth] = useState(null);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const healthRes = await api.get('/system/health');
                const statsRes = await api.get('/analytics/stats');
                setHealth(healthRes.data);
                setStats(statsRes.data);
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            }
        };
        fetchData();
    }, []);

    return (
        <Box>
            <Typography variant="h4" gutterBottom>Dashboard</Typography>
            <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 140 }}>
                        <Typography component="h2" variant="h6" color="primary" gutterBottom>
                            System Status
                        </Typography>
                        <Typography component="p" variant="h4">
                            {health ? 'Online' : 'Loading...'}
                        </Typography>
                        <Typography color="text.secondary" sx={{ flex: 1 }}>
                            Uptime: {health ? Math.floor(health.uptime / 60) + ' min' : '-'}
                        </Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 140 }}>
                        <Typography component="h2" variant="h6" color="primary" gutterBottom>
                            Total Moves Analyzed
                        </Typography>
                        <Typography component="p" variant="h4">
                            {stats ? stats.total_moves : 'Loading...'}
                        </Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 140 }}>
                        <Typography component="h2" variant="h6" color="primary" gutterBottom>
                            Games Analyzed
                        </Typography>
                        <Typography component="p" variant="h4">
                            {stats ? stats.total_games_analyzed : 'Loading...'}
                        </Typography>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default Dashboard;
