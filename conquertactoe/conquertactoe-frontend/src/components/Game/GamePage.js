import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Box } from '@material-ui/core';
import axios from 'axios';
import GameBoard from '../GameBoard/GameBoard';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import { useSelector } from 'react-redux';
import socket from '../../utils/socket'; // Use shared socket instance

const GamePage = () => {
  const { gameId } = useParams();
  const [game, setGame] = useState(null);
  const [creatorName, setCreatorName] = useState('');
  const [joinerName, setJoinerName] = useState('');
  const [error, setError] = useState(null);

  // REMOVED: const [winner, setWinner] = useState(null);
  // REMOVED: const [isDraw, setIsDraw] = useState(false);
  // Derive winner and isDraw from game.status instead of storing in state
  const winner = game?.winner;
  const isDraw = game?.status === 'draw';

  const backendUrl = process.env.REACT_APP_BACKEND_URL;

  const auth = useSelector(state => state.auth);

  useEffect(() => {
    console.log('Initializing GamePage component...');

    // Ensure socket is connected if not already
    if (!socket.connected) {
      socket.connect();
    }

    const fetchGame = async () => {
      try {
        console.log(`Fetching game data for game ID: ${gameId}`);
        const res = await axios.get(`${backendUrl}/game-requests/${gameId}`, { withCredentials: true });
        console.log('Fetched game data:', res.data);
        setGame(res.data);

        const creatorRes = await axios.get(`${backendUrl}/users/${res.data.creator_id}`, { withCredentials: true });
        console.log('Fetched creator name:', creatorRes.data.username);
        setCreatorName(creatorRes.data.username);

        if (res.data.joiner_id) {
          const joinerRes = await axios.get(`${backendUrl}/users/${res.data.joiner_id}`, { withCredentials: true });
          console.log('Fetched joiner name:', joinerRes.data.username);
          setJoinerName(joinerRes.data.username);
        } else if (res.data.game_type === 'bot') {
          // For bot games, display difficulty level alongside "Bot AI"
          const difficulty = res.data.bot_difficulty || 'medium';
          const capitalizedDifficulty = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
          setJoinerName(`Bot AI (${capitalizedDifficulty})`);
          console.log(`Bot game detected, setting joiner name to Bot AI (${capitalizedDifficulty})`);
        }

        if (res.data.status === 'won' || res.data.status === 'surrendered') {
          // REMOVED: setWinner(...) - winner is now derived from game.winner
          console.log('Winner:', res.data.winner);
        } else if (res.data.status === 'draw') {
          // REMOVED: setIsDraw(true) - isDraw is now derived from game.status
          console.log('Game is a draw.');
        } else if (res.data.status === 'cancelled') {
          setError('The game was cancelled.');
        }

      } catch (error) {
        console.error('Error fetching game:', error.response?.data || error.message);
        if (error.response && error.response.status === 403) {
          setError('Access denied: You do not have permission to view this game.');
        } else {
          setError('Error fetching game. Please try again later.');
        }
      }
    };

    const handleGameUpdated = (updatedGame) => {
      console.log(`[${new Date().toISOString()}] Socket gameUpdated:`, updatedGame);
      if (parseInt(updatedGame.gameId) === parseInt(gameId) || parseInt(updatedGame.id) === parseInt(gameId)) {
        console.log('Current game state before update:', game);
        // Force new object reference to ensure re-render
        setGame(prev => {
          // If we already have a winner locally (from gameWon event), don't overwrite it with 'joined' status from gameUpdated
          // This prevents race conditions where gameUpdated arrives after gameWon
          if (prev?.status === 'won') {
            console.log('Ignoring status update from gameUpdated because game is already won');
            return { ...updatedGame, status: 'won', winner: prev.winner };
          }
          return { ...updatedGame };
        });
        console.log('Updated game state after setting:', updatedGame);
      }
    };

    const handleGameWon = (gameWonData) => {
      console.log('Received gameWon event from socket:', gameWonData);
      console.log('Current game state before gameWon update:', game);
      // Convert to string for comparison as gameId from params is string but socket sends number
      if (String(gameWonData.gameId) === String(gameId)) {
        setGame(prev => {
          const newState = { ...prev, status: 'won', winner: gameWonData.winner };
          console.log('Setting new game state from gameWon:', newState);
          return newState;
        });
      } else {
        console.warn('Ignored gameWon event due to ID mismatch:', { socketId: gameWonData.gameId, currentId: gameId });
      }
    };

    const handleGameDraw = (gameDrawData) => {
      console.log('Received gameDraw event from socket:', gameDrawData);
      if (String(gameDrawData.gameId) === String(gameId)) {
        setGame(prev => {
          const newState = { ...prev, status: 'draw' };
          console.log('Setting new game state from gameDraw:', newState);
          return newState;
        });
      }
    };

    socket.on('gameUpdated', handleGameUpdated);
    socket.on('gameWon', handleGameWon);
    socket.on('gameDraw', handleGameDraw);

    socket.on('gameTimeout', (timeoutData) => {
      console.log('Received gameTimeout event from socket:', timeoutData);
      if (String(timeoutData.gameId) === String(gameId)) {
        setGame(prev => ({ ...prev, status: 'won', winner: timeoutData.winner }));
      }
    });

    socket.on('gameSurrendered', (surrenderData) => {
      console.log('Received gameSurrendered event from socket:', surrenderData);
      if (String(surrenderData.gameId) === String(gameId)) {
        setGame(prev => ({ ...prev, status: 'won', winner: surrenderData.winner }));
      }
    });

    socket.on('playerJoined', (joinedGame) => {
      console.log('Received playerJoined event from socket: ' + JSON.stringify(joinedGame));
      console.log('Current gameId: ' + gameId);

      // Convert both IDs to strings before comparison
      const joinedGameId = String(joinedGame.id);
      const currentGameId = String(gameId);

      console.log('Comparing IDs:', { joinedGameId, currentGameId });

      if (joinedGameId === currentGameId) {
        console.log('IDs match, updating game state...');
        setGame(prevGame => {
          if (prevGame) {
            console.log('Current game state before update:', prevGame);

            if (prevGame.status !== joinedGame.status) {
              console.log('Game status changed to joined');
              return { ...joinedGame }; // Force a re-render by passing a new object reference
            }
            console.log('No change in game status, returning previous state');
          } else {
            console.log('Previous game state is null or undefined');
          }
          return prevGame;
        });

        axios.get(`${backendUrl}/users/${joinedGame.joiner_id}`, { withCredentials: true })
          .then(joinerRes => {
            console.log('Fetched joiner name:', joinerRes.data.username);
            setJoinerName(joinerRes.data.username);
          })
          .catch(err => console.error('Error fetching joiner name:', err));
      } else {
        console.log('Joined game ID does not match the current gameId.');
      }
    });


    fetchGame();

    return () => {
      console.log('Disconnecting socket handlers (and socket) for GamePage');
      socket.off('gameUpdated', handleGameUpdated);
      socket.off('gameWon', handleGameWon);
      socket.off('gameDraw', handleGameDraw);
      socket.off('gameTimeout');
      socket.off('gameSurrendered');
      socket.off('playerJoined');
      // Do not disconnect the socket here as it's shared across the app
    };
  }, [backendUrl, gameId]);

  useEffect(() => {
    if (game) {
      console.log('Game state updated in GamePage, new game status:', game.status);
    }
  }, [game]);

  useEffect(() => {
    console.log('Winner from backend:', winner);
  }, [winner]);

  const updateGame = async (newBoard, activePlayer, player1Cones, player2Cones, row, col, selectedCone) => {
    try {
      if (!game.joiner_id && game.game_type !== 'bot') {
        setError('The game cannot start without another player.');
        return;
      }

      console.log('Updating game with new board state:', newBoard);
      const res = await axios.put(`${backendUrl}/game-requests/${gameId}`, {
        board: newBoard,
        activePlayer,
        player1Cones,
        player2Cones,
        row,
        col,
        coneSize: selectedCone
      }, { withCredentials: true });
      console.log('Updated game data:', res.data);
      if (!res.data.game_type) {
        console.warn('Warning: game_type missing in response data!', res.data);
      }

      // Update game state from response (fallback for WebSocket)
      // Since backend awaits bot move, this should be fresh data
      setGame(res.data);
    } catch (error) {
      console.error('Error updating game:', error.response?.data || error.message);
      setError(error.response?.data || error.message);
    }
  };

  if (error) {
    return (
      <Container>
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" mt={5}>
          <ErrorMessage message={error} />
        </Box>
      </Container>
    );
  }

  if (!game) {
    return <div>Loading...</div>;
  }

  console.log('Rendering GameBoard with winner:', game.winner, 'and game status:', game.status);
  if (!auth.user) {
    return <div>Loading user data...</div>;
  }

  return (
    <main>
      <Container>
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" mt={5}>
          <GameBoard
            game={game}
            updateGame={updateGame}
            creatorName={creatorName}
            joinerName={joinerName}
            winner={game.winner}
            isDraw={isDraw}
            gameResult={game.status}
            currentUser={auth.user}
          />
        </Box>
      </Container>
    </main>
  );
};

export default GamePage;
