import React, { useEffect, useState } from 'react';
import {
    Box,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    Button,
    Snackbar,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions
} from '@mui/material';
import api from '../api';

const Games = () => {
    const [games, setGames] = useState([]);
    const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
    const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', content: '', action: null });

    useEffect(() => {
        fetchGames();
    }, []);

    const fetchGames = async () => {
        try {
            const res = await api.get('/games');
            setGames(res.data);
        } catch (error) {
            console.error('Error fetching games:', error);
            // Optionally show a notification for fetching error
            showNotification('Failed to fetch games', 'error');
        }
    };

    const showNotification = (message, severity = 'success') => {
        setNotification({ open: true, message, severity });
    };

    const handleDeleteClick = (id) => {
        setConfirmDialog({
            open: true,
            title: 'Delete Game',
            content: 'Are you sure you want to delete this game? This action cannot be undone.',
            action: () => deleteGame(id)
        });
    };

    const handleResetClick = (id) => {
        setConfirmDialog({
            open: true,
            title: 'Reset Game',
            content: 'Are you sure you want to reset this game? This will clear the board and restart the match.',
            action: () => resetGame(id)
        });
    };

    const deleteGame = async (id) => {
        try {
            await api.delete(`/games/${id}`);
            showNotification('Game deleted successfully', 'success');
            fetchGames();
        } catch (error) {
            console.error('Error deleting game:', error);
            showNotification(error.response?.data?.error || 'Failed to delete game', 'error');
        }
        setConfirmDialog({ ...confirmDialog, open: false });
    };

    const resetGame = async (id) => {
        try {
            await api.post(`/games/${id}/reset`);
            showNotification('Game reset successfully', 'success');
            fetchGames();
        } catch (error) {
            console.error('Error resetting game:', error);
            showNotification(error.response?.data?.error || 'Failed to reset game', 'error');
        }
        setConfirmDialog({ ...confirmDialog, open: false });
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
                                        onClick={() => handleResetClick(game.id)}
                                    >
                                        Reset
                                    </Button>
                                    <Button
                                        color="error"
                                        size="small"
                                        onClick={() => handleDeleteClick(game.id)}
                                    >
                                        Delete
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog
                open={confirmDialog.open}
                onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}
            >
                <DialogTitle>{confirmDialog.title}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {confirmDialog.content}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmDialog({ ...confirmDialog, open: false })} color="primary">
                        Cancel
                    </Button>
                    <Button onClick={confirmDialog.action} color="error" autoFocus>
                        Confirm
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={notification.open}
                autoHideDuration={4000}
                onClose={() => setNotification({ ...notification, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert
                    onClose={() => setNotification({ ...notification, open: false })}
                    severity={notification.severity}
                    variant="filled"
                >
                    {notification.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default Games;
