import React, { useState, useEffect } from 'react';
import { Modal, Box, Typography, TextField, Button } from '@mui/material';
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

const EditUserModal = ({ open, handleClose, user, onUserUpdated }) => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (user) {
            setUsername(user.username);
            setEmail(user.email);
        }
    }, [user]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await api.put(`/users/${user.user_id}`, { username, email });
            onUserUpdated();
            handleClose();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update user');
        }
    };

    return (
        <Modal open={open} onClose={handleClose}>
            <Box sx={style}>
                <Typography variant="h6" component="h2" gutterBottom>
                    Edit User
                </Typography>
                {error && <Typography color="error" variant="body2" gutterBottom>{error}</Typography>}
                <form onSubmit={handleSubmit}>
                    <TextField
                        fullWidth
                        label="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        margin="normal"
                        required
                    />
                    <TextField
                        fullWidth
                        label="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        margin="normal"
                        required
                        type="email"
                    />
                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                        <Button onClick={handleClose}>Cancel</Button>
                        <Button type="submit" variant="contained">Save</Button>
                    </Box>
                </form>
            </Box>
        </Modal>
    );
};

export default EditUserModal;
