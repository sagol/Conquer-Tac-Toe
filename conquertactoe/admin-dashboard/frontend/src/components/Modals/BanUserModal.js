import React, { useState } from 'react';
import { Modal, Box, Typography, TextField, Button, FormControl, InputLabel, Select, MenuItem, FormControlLabel, Checkbox } from '@mui/material';
import api from '../../api';

const style = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 400,
    bgcolor: 'background.paper',
    boxShadow: 24,
    p: 4,
    borderRadius: 2
};

const BanUserModal = ({ open, handleClose, user, onUserUpdated }) => {
    const [duration, setDuration] = useState(24); // Default 24 hours
    const [reason, setReason] = useState('');
    const [permanent, setPermanent] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await api.post(`/users/${user.user_id}/ban`, {
                duration: permanent ? null : duration,
                reason,
                permanent
            });
            onUserUpdated();
            handleClose();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to ban user');
        }
    };

    return (
        <Modal open={open} onClose={handleClose}>
            <Box sx={style}>
                <Typography variant="h6" component="h2" gutterBottom>
                    Ban User: {user?.username}
                </Typography>
                {error && <Typography color="error" variant="body2" gutterBottom>{error}</Typography>}
                <form onSubmit={handleSubmit}>
                    <FormControlLabel
                        control={<Checkbox checked={permanent} onChange={(e) => setPermanent(e.target.checked)} />}
                        label="Permanent Ban"
                    />

                    {!permanent && (
                        <FormControl fullWidth margin="normal">
                            <InputLabel>Duration</InputLabel>
                            <Select
                                value={duration}
                                label="Duration"
                                onChange={(e) => setDuration(e.target.value)}
                            >
                                <MenuItem value={1}>1 Hour</MenuItem>
                                <MenuItem value={24}>24 Hours</MenuItem>
                                <MenuItem value={168}>7 Days</MenuItem>
                                <MenuItem value={720}>30 Days</MenuItem>
                            </Select>
                        </FormControl>
                    )}

                    <TextField
                        fullWidth
                        label="Reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        margin="normal"
                        required
                        multiline
                        rows={3}
                    />

                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                        <Button onClick={handleClose}>Cancel</Button>
                        <Button type="submit" variant="contained" color="error">Ban User</Button>
                    </Box>
                </form>
            </Box>
        </Modal>
    );
};

export default BanUserModal;
