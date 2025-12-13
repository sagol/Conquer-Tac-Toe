import React, { useEffect, useState } from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, Chip, IconButton, Tooltip } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../api';
import EditUserModal from '../components/Modals/EditUserModal';
import BanUserModal from '../components/Modals/BanUserModal';

const Users = () => {
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [banModalOpen, setBanModalOpen] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await api.get('/users');
            setUsers(res.data);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            try {
                await api.delete(`/users/${id}`);
                fetchUsers();
            } catch (error) {
                console.error('Error deleting user:', error);
            }
        }
    };

    const handleUnban = async (id) => {
        if (window.confirm('Are you sure you want to unban this user?')) {
            try {
                await api.post(`/users/${id}/unban`);
                fetchUsers();
            } catch (error) {
                console.error('Error unbanning user:', error);
            }
        }
    };

    const openEditModal = (user) => {
        setSelectedUser(user);
        setEditModalOpen(true);
    };

    const openBanModal = (user) => {
        setSelectedUser(user);
        setBanModalOpen(true);
    };

    return (
        <Box>
            <Typography variant="h4" gutterBottom>Users</Typography>
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Username</TableCell>
                            <TableCell>Email</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Created At</TableCell>
                            <TableCell align="right">Wins</TableCell>
                            <TableCell align="right">Losses</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.user_id} sx={{ bgcolor: user.is_banned ? 'action.hover' : 'inherit' }}>
                                <TableCell>{user.username}</TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>
                                    {user.is_banned ? (
                                        <Tooltip title={user.ban_reason || 'No reason provided'}>
                                            <Chip
                                                label={user.ban_expires_at ? `Banned until ${new Date(user.ban_expires_at).toLocaleDateString()}` : 'Permanently Banned'}
                                                color="error"
                                                size="small"
                                                icon={<BlockIcon />}
                                            />
                                        </Tooltip>
                                    ) : (
                                        <Chip label="Active" color="success" size="small" />
                                    )}
                                </TableCell>
                                <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                                <TableCell align="right">{user.wins}</TableCell>
                                <TableCell align="right">{user.losses}</TableCell>
                                <TableCell align="right">
                                    <Tooltip title="Edit">
                                        <IconButton onClick={() => openEditModal(user)} color="primary">
                                            <EditIcon />
                                        </IconButton>
                                    </Tooltip>

                                    {user.is_banned ? (
                                        <Tooltip title="Unban">
                                            <IconButton onClick={() => handleUnban(user.user_id)} color="success">
                                                <CheckCircleIcon />
                                            </IconButton>
                                        </Tooltip>
                                    ) : (
                                        <Tooltip title="Ban">
                                            <IconButton onClick={() => openBanModal(user)} color="warning">
                                                <BlockIcon />
                                            </IconButton>
                                        </Tooltip>
                                    )}

                                    <Tooltip title="Delete">
                                        <IconButton onClick={() => handleDelete(user.user_id)} color="error">
                                            <DeleteIcon />
                                        </IconButton>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <EditUserModal
                open={editModalOpen}
                handleClose={() => setEditModalOpen(false)}
                user={selectedUser}
                onUserUpdated={fetchUsers}
            />

            <BanUserModal
                open={banModalOpen}
                handleClose={() => setBanModalOpen(false)}
                user={selectedUser}
                onUserUpdated={fetchUsers}
            />
        </Box>
    );
};

export default Users;
