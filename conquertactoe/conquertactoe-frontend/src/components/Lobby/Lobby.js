import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Container, Box, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Snackbar, Typography} from '@material-ui/core';
import Pagination from '@material-ui/lab/Pagination';
import axios from 'axios';
import { io } from 'socket.io-client';
import { fetchActiveGameRequests, addGameRequest, updateGameRequest } from '../../redux/actions/gameRequestActions';
import './Lobby.css';

const Lobby = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const gameRequests = useSelector(state => state.gameRequests.gameRequests);
  const auth = useSelector(state => state.auth);
  const [socket, setSocket] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [userStats, setUserStats] = useState({ wins: 0, losses: 0, draws: 0 });
  const backendUrl = process.env.REACT_APP_BACKEND_URL;
  const totalPages = useSelector(state => state.gameRequests.totalPages);
  const [page, setPage] = useState(1);

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
      console.log(`Fetching game requests for page: ${page}`);
      dispatch(fetchActiveGameRequests(page));
      const newSocket = io(backendUrl);
      setSocket(newSocket);

      newSocket.on('gameRequestCreated', (gameRequest) => {
        dispatch(addGameRequest(gameRequest));
      });

      newSocket.on('gameRequestJoined', (gameRequest) => {
        dispatch(updateGameRequest(gameRequest));
      });

      newSocket.on('gameRequestCancelled', (gameRequest) => {
        dispatch({ type: 'REMOVE_GAME_REQUEST', payload: gameRequest.id });
      });

      return () => newSocket.close();
    }
  }, [dispatch, backendUrl, auth.user, page]);

  const handlePageChange = (event, value) => {
    setPage(value);
    dispatch(fetchActiveGameRequests(value));
  };

  const createGameRequest = async () => {
    try {
      const res = await axios.post(`${backendUrl}/game-requests`, { gameType: 'public' }, { withCredentials: true });
      navigate(`/game/${res.data.id}`);
    } catch (error) {
      setError(error.response?.data.error || error.message);
      setOpen(true);
    }
  };

  const joinGameRequest = async (requestId) => {
    try {
      const res = await axios.post(`${backendUrl}/game-requests/${requestId}/join`, {}, { withCredentials: true });
      navigate(`/game/${res.data.id}`);
    } catch (error) {
      setError(error.response?.data.error || error.message);
      setOpen(true);
    }
  };

  const deleteGameRequest = async (requestId) => {
    try {
      await axios.delete(`${backendUrl}/game-requests/${requestId}`, { withCredentials: true });
      dispatch({ type: 'REMOVE_GAME_REQUEST', payload: requestId });
    } catch (error) {
      setError(error.response?.data.error || error.message);
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

  return (
    <Container className="lobby-container">
      <Box className="lobby-box">
        <Typography variant="h5">Your Stats</Typography>
        <Typography variant="body1">Wins: {userStats.wins}</Typography>
        <Typography variant="body1">Losses: {userStats.losses}</Typography>
        <Typography variant="body1">Draws: {userStats.draws}</Typography>
        {!userPendingOrJoined && (
          <Button variant="contained" color="primary" onClick={createGameRequest} className="lobby-button">Create Game Request</Button>
        )}
        <TableContainer component={Paper} className="table-container">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Creator</TableCell>
                <TableCell>Game Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {gameRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>{request.creator_name}</TableCell>
                  <TableCell>{request.game_type}</TableCell>
                  <TableCell>{getUserGameStatus(request)}</TableCell>
                  <TableCell>
                    {canJoin(request) ? (
                      <Button variant="contained" color="secondary" onClick={() => joinGameRequest(request.id)} className="lobby-button">Join</Button>
                    ) : (request.creator_id === auth.user?.user_id && request.status === 'pending') ? (
                      <Button variant="contained" color="secondary" onClick={() => deleteGameRequest(request.id)} className="lobby-button">Delete</Button>
                    ) : (request.creator_id === auth.user?.user_id || request.joiner_id === auth.user?.user_id) ? (
                      <Button variant="contained" color="primary" onClick={() => navigate(`/game/${request.id}`)} className="lobby-button">Go to Game</Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Pagination count={totalPages} page={page} onChange={handlePageChange}/>
      </Box>
      <Snackbar
        open={open}
        autoHideDuration={6000}
        onClose={handleClose}
        message={error}
      />
    </Container>
  );
};

export default Lobby;
