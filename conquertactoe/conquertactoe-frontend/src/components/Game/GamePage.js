import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Container, Box } from '@material-ui/core';
import axios from 'axios';
import GameBoard from '../GameBoard/GameBoard';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import SEO from '../Common/SEO';
import { useSelector } from 'react-redux';
import socket from '../../utils/socket'; // Use shared socket instance

const GamePage = () => {
  const { gameId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [game, setGame] = useState(null);
  const [creatorName, setCreatorName] = useState('');
  const [joinerName, setJoinerName] = useState('');
  const [error, setError] = useState(null);

  // Derive winner and isDraw from game.status instead of storing in state
  const winner = game?.winner;
  const isDraw = game?.status === 'draw';

  const backendUrl = process.env.REACT_APP_BACKEND_URL;

  const auth = useSelector(state => state.auth);

  useEffect(() => {

    // Ensure socket is connected if not already
    if (!socket.connected) {
      socket.connect();
    }

    // Join the game room to indicate we're viewing this game
    // This is used to suppress in-game notifications when we're on the board
    socket.emit('joinGameRoom', gameId);

    // Handler for connection errors
    const handleConnectError = (err) => {
      console.error('Socket connection error:', err);
      setError('Failed to connect to game server. Please refresh.');
    };

    socket.on('connect_error', handleConnectError);

    const fetchGame = async (retryCount = 0) => {
      const maxRetries = 3;
      const retryDelays = [500, 1000, 2000]; // Exponential backoff: 500ms, 1s, 2s

      try {
        const res = await axios.get(`${backendUrl}/game-requests/${gameId}`, { withCredentials: true });
        setGame(res.data);

        const creatorRes = await axios.get(`${backendUrl}/users/${res.data.creator_id}`, { withCredentials: true });
        setCreatorName(creatorRes.data.username);

        if (res.data.joiner_id) {
          const joinerRes = await axios.get(`${backendUrl}/users/${res.data.joiner_id}`, { withCredentials: true });
          setJoinerName(joinerRes.data.username);
        } else if (res.data.game_type === 'bot') {
          // For bot games, display difficulty level alongside "Bot AI"
          const difficulty = res.data.bot_difficulty || 'medium';
          const capitalizedDifficulty = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
          setJoinerName(`Bot AI (${capitalizedDifficulty})`);
        } else {
          // No joiner yet (pending public game) - reset to empty/waiting state
          setJoinerName('');
        }

        if (res.data.status === 'cancelled') {
          setError('The game was cancelled.');
        }

      } catch (error) {
        console.error('Error fetching game:', error.response?.data || error.message);

        // Retry logic for transient errors (e.g., race condition after rematch)
        if (retryCount < maxRetries) {
          const delay = retryDelays[retryCount];
          setTimeout(() => fetchGame(retryCount + 1), delay);
          return;
        }

        // Final failure after all retries
        if (error.response && error.response.status === 403) {
          setError('Access denied: You do not have permission to view this game.');
        } else {
          setError('Error fetching game. Please try again later.');
        }
      }
    };

    const handleGameUpdated = (updatedGame) => {
      if (parseInt(updatedGame.gameId) === parseInt(gameId) || parseInt(updatedGame.id) === parseInt(gameId)) {
        // Force new object reference to ensure re-render
        setGame(prev => {
          // If we already have a winner locally (from gameWon event), don't overwrite it with 'joined' status from gameUpdated
          // This prevents race conditions where gameUpdated arrives after gameWon
          if (prev?.status === 'won') {
            return { ...updatedGame, status: 'won', winner: prev.winner };
          }
          return { ...updatedGame };
        });
      }
    };

    const handleGameWon = (gameWonData) => {
      // Convert to string for comparison as gameId from params is string but socket sends number
      if (String(gameWonData.gameId) === String(gameId)) {
        setGame(prev => ({ ...prev, status: 'won', winner: gameWonData.winner }));
      }
    };

    const handleGameDraw = (gameDrawData) => {
      if (String(gameDrawData.gameId) === String(gameId)) {
        setGame(prev => {
          const newState = { ...prev, status: 'draw' };
          return newState;
        });
      }
    };

    const handleGameTimeout = (timeoutData) => {
      if (String(timeoutData.gameId) === String(gameId)) {
        setGame(prev => ({ ...prev, status: 'won', winner: timeoutData.winner }));
      }
    };

    const handleGameSurrendered = (surrenderData) => {
      if (String(surrenderData.gameId) === String(gameId)) {
        setGame(prev => ({ ...prev, status: 'won', winner: surrenderData.winner }));
      }
    };

    const handlePlayerJoined = (joinedGame) => {

      // Convert both IDs to strings before comparison
      const joinedGameId = String(joinedGame.id);
      const currentGameId = String(gameId);


      if (joinedGameId === currentGameId) {
        setGame(prevGame => {
          if (prevGame && prevGame.status !== joinedGame.status) {
            return { ...joinedGame }; // Force a re-render by passing a new object reference
          }
          return prevGame;
        });

        axios.get(`${backendUrl}/users/${joinedGame.joiner_id}`, { withCredentials: true })
          .then(joinerRes => {
            setJoinerName(joinerRes.data.username);
          })
          .catch(err => console.error('Error fetching joiner name:', err));
      }
    };

    socket.on('gameUpdated', handleGameUpdated);
    socket.on('gameWon', handleGameWon);
    socket.on('gameDraw', handleGameDraw);
    socket.on('gameTimeout', handleGameTimeout);
    socket.on('gameSurrendered', handleGameSurrendered);
    socket.on('playerJoined', handlePlayerJoined);


    fetchGame();

    return () => {
      socket.off('gameUpdated', handleGameUpdated);
      socket.off('gameWon', handleGameWon);
      socket.off('gameDraw', handleGameDraw);
      socket.off('gameTimeout', handleGameTimeout);
      socket.off('gameSurrendered', handleGameSurrendered);
      socket.off('playerJoined', handlePlayerJoined);
      socket.off('connect_error', handleConnectError);

      // Leave game room when unmounting to indicate we're no longer viewing
      socket.emit('leaveGameRoom', gameId);

      // Note: Socket is NOT disconnected here as it's a shared singleton instance.
      // Disconnecting would break real-time features in other components (Lobby, Notifications).
      // Socket lifecycle is managed centrally by App.js and AuthContext.
    };
  }, [backendUrl, gameId]);

  const updateGame = async (newBoard, activePlayer, player1Cones, player2Cones, row, col, selectedCone) => {
    try {
      if (!game.joiner_id && game.game_type !== 'bot') {
        setError('The game cannot start without another player.');
        return;
      }

      const res = await axios.put(`${backendUrl}/game-requests/${gameId}`, {
        board: newBoard,
        activePlayer,
        player1Cones,
        player2Cones,
        row,
        col,
        coneSize: selectedCone
      }, { withCredentials: true });

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

  if (!auth.user) {
    return <div>Loading user data...</div>;
  }

  // At this point, 'game' is guaranteed to be truthy due to early return on line 258
  const seoTitle = `Game #${gameId} (${game.game_type})`;

  return (
    <Container maxWidth="md" style={{ marginTop: '20px', paddingBottom: '40px' }}>
      <SEO
        title={seoTitle}
        description={`Watch or play Game #${gameId} on Conquer-Tac-Toe. ${creatorName ? `Host: ${creatorName}` : ''}`}
      />
      <Box display="flex" flexDirection="column" alignItems="center">
        {/* At this point, both 'error' and 'game' are guaranteed values due to early returns above (lines 248-260) */}
        <GameBoard
          game={game}
          updateGame={updateGame}
          creatorName={creatorName}
          joinerName={joinerName}
          winner={winner}
          isDraw={isDraw}
          gameResult={game.status}
          currentUser={auth.user}
          socket={socket}
          openRematchModal={searchParams.get('rematch') === 'true'}
          onClearRematchParam={() => setSearchParams({})}
        />
      </Box>
    </Container>
  );
};

export default GamePage;
