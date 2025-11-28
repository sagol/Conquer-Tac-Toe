import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../api';

const Analytics = () => {
    const [moves, setMoves] = useState([]);

    useEffect(() => {
        const fetchMoves = async () => {
            try {
                const res = await api.get('/analytics/moves');
                // Process data for chart (e.g., moves per minute/hour)
                // For simplicity, just showing raw moves or a simple aggregation
                // Let's assume we want to show moves over time
                const processed = res.data.map(m => ({
                    time: new Date(m.timestamp).toLocaleTimeString(),
                    gameId: m.game_id
                })).reverse();
                setMoves(processed);
            } catch (error) {
                console.error('Error fetching analytics:', error);
            }
        };
        fetchMoves();
    }, []);

    return (
        <Box>
            <Typography variant="h4" gutterBottom>Analytics</Typography>
            <Paper sx={{ p: 3, height: 400 }}>
                <Typography variant="h6" gutterBottom>Recent Activity</Typography>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={moves}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="gameId" stroke="#8884d8" activeDot={{ r: 8 }} />
                    </LineChart>
                </ResponsiveContainer>
            </Paper>
        </Box>
    );
};

export default Analytics;
