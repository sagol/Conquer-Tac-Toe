import React, { useEffect, useState } from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, Chip } from '@mui/material';
import api from '../api';

const Games = () => {
    const [games, setGames] = useState([]);

    useEffect(() => {
        fetchGames();
    }, []);

    const fetchGames = async () => {
        try {
            const res = await api.get('/games');
            setGames(res.data);
        } catch (error) {
            console.error('Error fetching games:', error);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this game? This action cannot be undone.')) {
            try {
                await api.delete(`/games/${id}`);
                fetchGames();
            } catch (error) {
                console.error('Error deleting game:', error);
            }
        }
    };

    const handleReset = async (id) => {
        if (window.confirm('Are you sure you want to reset this game? This will clear the board and restart the match.')) {
            try {
                await api.post(`/games/${id}/reset`);
                fetchGames();
            } catch (error) {
                console.error('Error resetting game:', error);
            }
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'won': return 'success';
            case 'pending': return 'warning';
            case 'joined': return 'info';
            default: return 'default';
        }
    };

    return (
        <Box>
            <Typography variant="h4" gutterBottom>Active Games</Typography>
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>ID</TableCell>
                            <TableCell>Creator</TableCell>
                            <TableCell>Joiner</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Variant</TableCell>
                            <TableCell>Last Update</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {games.map((game) => (
                            <TableRow key={game.id}>
                                <TableCell>{String(game.id)}</TableCell>
                                <TableCell>{game.creator_name}</TableCell>
                                <TableCell>{game.joiner_name || '-'}</TableCell>
                                <TableCell>
                                    <Chip label={game.status} color={getStatusColor(game.status)} size="small" />
                                </TableCell>
                                <TableCell>{game.variant_id}</TableCell>
                                <TableCell>{new Date(game.created_at).toLocaleString()}</TableCell>
                                <TableCell align="right">
                                    <Button
                                        color="warning"
                                        size="small"
                                        sx={{ mr: 1 }}
                                        onClick={() => handleReset(game.id)}
                                    >
                                        Reset
                                    </Button>
                                    <Button
                                        color="error"
                                        size="small"
                                        onClick={() => handleDelete(game.id)}
                                    >
                                        Delete
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default Games;
