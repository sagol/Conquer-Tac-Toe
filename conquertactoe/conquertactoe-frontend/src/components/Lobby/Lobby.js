import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Button, Table, TableBody, TableCell, TableHead, TableRow, Snackbar, Typography, Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions } from '@material-ui/core';
import Pagination from '@material-ui/lab/Pagination';
import axios from 'axios';
import socket from '../../utils/socket'; // Use shared socket instance
import { fetchActiveGameRequests, addGameRequest, updateGameRequest } from '../../redux/actions/gameRequestActions';
import CreateGameModal from './CreateGameModal';
import SEO from '../Common/SEO';
import '../Common/SharedModernStyles.css';
import './Lobby.css';

const Lobby = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const gameRequests = useSelector(state => state.gameRequests.gameRequests);
  const auth = useSelector(state => state.auth);
  // socket state is removed, use imported socket directly
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [userStats, setUserStats] = useState({ wins: 0, losses: 0, draws: 0 });
  const backendUrl = process.env.REACT_APP_BACKEND_URL;
  const totalPages = useSelector(state => state.gameRequests.totalPages);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setPage(1); // Reset to page 1 when switching tabs
  };

  // Helper function to format timestamps
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  useEffect(() => {
    if (auth.user) {
      const fetchStats = async () => {
        try {
          console.log('Fetching stats for user:', auth.user.user_id);
          const res = await axios.get(`${backendUrl}/users/${auth.user.user_id}/stats`, { withCredentials: true });
          console.log('Stats fetched:', res.data);
          setUserStats(res.data);
        } catch (error) {
          console.error('Error fetching user stats:', error.response?.data || error.message);
        }
      };

      fetchStats();
      console.log('Fetching all game requests');
      dispatch(fetchActiveGameRequests());

      // Ensure socket is connected if not already
      if (!socket.connected) {
        socket.connect();
      }

      const handleConnectError = (err) => {
        console.error('Lobby socket connection error:', err);
        setError('Lost connection to game server. Trying to reconnect...');
      };

      socket.on('connect_error', handleConnectError);

      // Event Listeners
      const handleGameRequestCreated = (gameRequest) => {
        dispatch(addGameRequest(gameRequest));
      };

      const handleGameRequestJoined = (gameRequest) => {
        dispatch(updateGameRequest(gameRequest));
      };

      const handleGameRequestCancelled = (gameRequest) => {
        dispatch({ type: 'REMOVE_GAME_REQUEST', payload: gameRequest.id });
      };

      socket.on('gameRequestCreated', handleGameRequestCreated);
      socket.on('gameRequestJoined', handleGameRequestJoined);
      socket.on('gameRequestCancelled', handleGameRequestCancelled);

      // Cleanup listeners on unmount
      return () => {
        socket.off('gameRequestCreated', handleGameRequestCreated);
        socket.off('gameRequestJoined', handleGameRequestJoined);
        socket.off('gameRequestCancelled', handleGameRequestCancelled);
        socket.off('connect_error', handleConnectError);
      };
    }
  }, [auth.user, dispatch, backendUrl]);
  const createGameRequest = async (gameData) => {
    try {
      const { gameType } = gameData;
      const endpoint = gameType === 'bot' ? `${backendUrl}/game-requests/bot` : `${backendUrl}/game-requests`;

      const res = await axios.post(endpoint, gameData, { withCredentials: true });
      navigate(`/game/${res.data.id}`);
    } catch (error) {
      // Extract user-friendly error message
      let errorMessage = 'Failed to create game. Please try again.';

      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.status === 403) {
        errorMessage = 'Game creation is currently disabled by the administrator.';
      } else if (error.response?.status === 404) {
        errorMessage = 'Unable to create game. Please try again.';
      }

      setError(errorMessage);
      setOpen(true);
    }
  };

  const joinGameRequest = async (requestId) => {
    try {
      const res = await axios.post(`${backendUrl}/game-requests/${requestId}/join`, {}, { withCredentials: true });
      navigate(`/game/${res.data.id}`);
    } catch (error) {
      let errorMessage = 'Failed to join game. Please try again.';

      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.status === 400) {
        errorMessage = 'Unable to join this game.';
      }

      setError(errorMessage);
      setOpen(true);
    }
  };

  const deleteGameRequest = async (requestId) => {
    try {
      await axios.delete(`${backendUrl}/game-requests/${requestId}`, { withCredentials: true });
      dispatch({ type: 'REMOVE_GAME_REQUEST', payload: requestId });
    } catch (error) {
      let errorMessage = 'Failed to delete game. Please try again.';

      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }

      setError(errorMessage);
      setOpen(true);
    }
  };

  const handleClose = () => {
    setOpen(false);
  };

  const userPendingOrJoined = gameRequests.some(
    request =>
      (request.creator_id === auth.user?.user_id && request.status === 'pending') ||
      (request.joiner_id === auth.user?.user_id && request.status === 'joined')
  );

  const canJoin = (request) => {
    return request.status === 'pending' &&
      request.creator_id !== auth.user?.user_id &&
      !userPendingOrJoined;
  };

  const getUserGameStatus = (request) => {
    if (!auth.user) {
      return request.status.charAt(0).toUpperCase() + request.status.slice(1);
    }

    if (request.status === 'won') {
      return request.winner === auth.user.user_id ? 'Win' : 'Loss';
    }
    if (request.status === 'draw') {
      return 'Draw';
    }
    return request.status.charAt(0).toUpperCase() + request.status.slice(1);
  };

  if (!auth.user) {
    return <div>Loading...</div>;
  }

  // Filter and sort games based on active tab
  const filteredGames = gameRequests
    .filter(request => {
      if (activeTab === 0) {
        // My Games (index 0): Games created by me or joined by me
        return request.creator_id === auth.user?.user_id || request.joiner_id === auth.user?.user_id;
      } else {
        // Public Games (index 1): Pending games created by others
        return request.status === 'pending' && request.creator_id !== auth.user?.user_id;
      }
    })
    .sort((a, b) => {
      // Sort pending games first
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      // Then sort by created_at descending (newest first)
      return new Date(b.created_at) - new Date(a.created_at);
    });

  return (
    <div className="lobby-container modern-container">
      <SEO
        title="Game Lobby"
        description="Join open games or create a new challenge in the Conquer-Tac-Toe lobby. Play vs AI or human opponents."
      />
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h2" className="modern-title" style={{ margin: 0 }}>
          Game Lobby
        </Typography>
        {!userPendingOrJoined && (
          <Button variant="contained" color="primary" onClick={() => setCreateModalOpen(true)} className="lobby-button" data-testid="create-game-request-button">
            Create Game Request
          </Button>
        )}
      </Box>

      <div className="lobby-box">
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          centered
          className="lobby-tabs"
          style={{ marginBottom: '20px' }}
        >
          <Tab label="My Games" />
          <Tab label="Public Games" />
        </Tabs>

        <div className="table-container">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Creator</TableCell>
                {activeTab === 0 ? (
                  <>
                    <TableCell>Game Type</TableCell>
                    <TableCell>Variant</TableCell>
                  </>
                ) : (
                  <TableCell>Variant</TableCell>
                )}
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredGames.length > 0 ? (
                filteredGames.map((request) => (
                  <TableRow
                    key={request.id}
                    hover
                    onClick={() => setSelectedRequest(request)}
                    style={{ cursor: 'pointer' }}
                    className={request.status === 'pending' ? 'pending-game' : ''}
                  >
                    <TableCell className="col-creator">{request.creator_name}</TableCell>
                    {activeTab === 0 ? (
                      <>
                        <TableCell className="col-type">{request.game_type}</TableCell>
                        <TableCell className="col-variant">{request.variant_display_name || 'Unknown'}</TableCell>
                      </>
                    ) : (
                      <TableCell className="col-variant">{request.variant_display_name || 'Unknown'}</TableCell>
                    )}
                    <TableCell className="col-status">{getUserGameStatus(request)}</TableCell>
                    <TableCell className="col-created">{formatTimestamp(request.created_at)}</TableCell>
                    <TableCell className="col-action">
                      {canJoin(request) ? (
                        <Button variant="contained" color="secondary" onClick={(e) => { e.stopPropagation(); joinGameRequest(request.id); }} className="lobby-button">Join</Button>
                      ) : (request.creator_id === auth.user?.user_id && request.status === 'pending') ? (
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                          <Button variant="contained" color="primary" onClick={(e) => { e.stopPropagation(); navigate(`/game/${request.id}`); }} className="lobby-button" aria-label="Go to game">Go</Button>
                          <Button variant="contained" color="secondary" onClick={(e) => { e.stopPropagation(); deleteGameRequest(request.id); }} className="lobby-button" aria-label="Delete game">Del</Button>
                        </div>
                      ) : (request.creator_id === auth.user?.user_id || request.joiner_id === auth.user?.user_id) ? (
                        <Button variant="contained" color="primary" onClick={(e) => { e.stopPropagation(); navigate(`/game/${request.id}`); }} className="lobby-button">Go</Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={activeTab === 0 ? 6 : 5} align="center">
                    {activeTab === 0 ? "You have no active games." : "No public games available."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>


        {/* Game Details Dialog */}
        <Dialog open={!!selectedRequest} onClose={() => setSelectedRequest(null)} maxWidth="sm" fullWidth>
          <DialogTitle>Game Details</DialogTitle>
          <DialogContent>
            {selectedRequest && (
              <Box>
                <Typography variant="body1" gutterBottom><strong>Creator:</strong> {selectedRequest.creator_name}</Typography>
                <Typography variant="body1" gutterBottom><strong>Game Type:</strong> {selectedRequest.game_type}</Typography>
                <Typography variant="body1" gutterBottom><strong>Variant:</strong> {selectedRequest.variant_display_name || 'Unknown'}</Typography>
                <Typography variant="body1" gutterBottom><strong>Status:</strong> {selectedRequest.status}</Typography>
                <Typography variant="body1" gutterBottom><strong>Created At:</strong> {new Date(selectedRequest.created_at).toLocaleString()}</Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSelectedRequest(null)} color="primary">Close</Button>
            {selectedRequest && canJoin(selectedRequest) && (
              <Button onClick={() => joinGameRequest(selectedRequest.id)} color="secondary" variant="contained">Join Game</Button>
            )}
          </DialogActions>
        </Dialog>
      </div>
      <Snackbar
        open={open}
        autoHideDuration={6000}
        onClose={handleClose}
        message={error}
      />

      <CreateGameModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={createGameRequest}
      />
    </div>
  );
};

export default Lobby;
