import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import CloseIcon from '@material-ui/icons/Close';

import './GameBoard.css';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import MoveTimer from './MoveTimer';
import RematchModal from './RematchModal';

const GameBoard = ({ game, updateGame, creatorName, joinerName, winner, isDraw, gameResult, currentUser, socket, openRematchModal, onClearRematchParam }) => {
  const navigate = useNavigate();
  const [board, setBoard] = useState([]);
  const [boardSize, setBoardSize] = useState(3); // Default to 3x3
  const [error, setError] = useState(null);
  const [variant, setVariant] = useState(null);
  const [player1Cones, setPlayer1Cones] = useState([3, 3, 3]);
  const [player2Cones, setPlayer2Cones] = useState([3, 3, 3]);
  const [selectedCone1, setSelectedCone1] = useState(2);
  const [selectedCone2, setSelectedCone2] = useState(2);
  const activePlayer = parseInt(game?.active_player) || 1;
  const prevStatusRef = useRef(game?.status);

  // Randomization State
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [randomizingName, setRandomizingName] = useState('');
  const [showFinalName, setShowFinalName] = useState(false);
  const [showResultOverlay, setShowResultOverlay] = useState(false); // Controls the game over modal

  // Effect to show overlay when game ends
  useEffect(() => {
    if (winner || isDraw) {
      setShowResultOverlay(true);
    }
  }, [winner, isDraw]);
  const [hasRandomized, setHasRandomized] = useState(false);
  const [frozenBoard, setFrozenBoard] = useState(null); // Holds empty board during randomization
  const [isSubmitting, setIsSubmitting] = useState(false); // Lock during backend processing

  // Rematch Modal State (for PvP games)
  const [showRematchModal, setShowRematchModal] = useState(false);
  const [rematchReceivedState, setRematchReceivedState] = useState(null); // { requesterName, timeoutMs }

  // Bot UI State
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [lastBotMove, setLastBotMove] = useState(null); // { row, col }
  const [winningCells, setWinningCells] = useState([]); // Array of { row, col }

  // Check for pending rematch via REST API when a finished game loads
  // This is a fallback for when socket authentication fails
  useEffect(() => {
    if (!game?.id || (!winner && !isDraw)) return;

    const checkPendingRematch = async () => {
      try {
        const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
        const response = await axios.get(
          `${backendUrl}/game-requests/${game.id}/pending-rematch`,
          { withCredentials: true }
        );

        if (response.data.hasPendingRematch) {
          console.log('[GameBoard] Found pending rematch via API:', response.data);
          setRematchReceivedState({
            requesterName: response.data.requesterName,
            timeoutMs: response.data.timeoutMs
          });
          setShowRematchModal(true);
        }
      } catch (error) {
        console.error('[GameBoard] Error checking pending rematch:', error);
      }
    };

    checkPendingRematch();
  }, [game?.id, winner, isDraw]);

  // Listen for rematchRequested socket event when on the game board
  useEffect(() => {
    if (!socket || !game?.id) return;

    const handleRematchRequested = ({ gameId, requesterId, requesterName, timeoutMs }) => {
      if (parseInt(gameId) === parseInt(game.id)) {
        console.log('[GameBoard] Received rematchRequested event from', requesterName);
        setRematchReceivedState({ requesterName, timeoutMs });
        setShowRematchModal(true);
      }
    };

    // Also listen for rematch acceptance to navigate to new game
    const handleRematchAccepted = ({ newGameId, originalGameId }) => {
      if (parseInt(originalGameId) === parseInt(game.id)) {
        console.log('[GameBoard] Rematch accepted, navigating to new game:', newGameId);
        // Reset modal state before navigation
        setShowRematchModal(false);
        setRematchReceivedState(null);

      }
    };

    socket.on('rematchRequested', handleRematchRequested);
    socket.on('rematchAccepted', handleRematchAccepted);

    // Join the game room to listen for game-specific events (like rematch)
    socket.emit('joinGameRoom', game.id);

    return () => {
      socket.off('rematchRequested', handleRematchRequested);
      socket.off('rematchAccepted', handleRematchAccepted);
      socket.emit('leaveGameRoom', game.id);
    };
  }, [socket, game?.id]);

  // Handle Timeout
  const handleTimeout = async () => {
    if (!game || winner || isDraw) return;

    console.log('Timeout detected in frontend, attempting to claim...');
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
      await axios.post(
        `${backendUrl}/game-requests/${game.id}/timeout`,
        { userId: currentUser.user_id },
        { withCredentials: true }
      );
    } catch (err) {
      console.error('Error claiming timeout:', err);
      // Don't show error to user immediately, backend might have beat us to it
    }
  };


  const handlePlayAgain = async () => {
    try {
      if (!game) return;

      const gameType = game.game_type || (game.joiner_id === null ? 'bot' : 'public');

      // For PvP games: Show rematch modal instead of creating new game directly
      if (gameType === 'public' && game.joiner_id) {
        console.log('[GameBoard] PvP game - showing rematch modal');
        setShowRematchModal(true);
        return;
      }

      // For Bot games: Create new game directly (existing behavior)
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';

      const gameData = {
        gameType: gameType,
        variantId: game.variant_id,
        boardSize: game.board_size,
      };

      const endpoint = gameType === 'bot' ? `${backendUrl}/game-requests/bot` : `${backendUrl}/game-requests`;

      console.log('Creating new game:', { endpoint, gameData });

      const res = await axios.post(endpoint, gameData, { withCredentials: true });

      // Navigate to the new game
      navigate(`/game/${res.data.id}`);

    } catch (err) {
      console.error('Error creating new game:', err);
      setError(err.response?.data?.error || 'Failed to start a new game. Please try again from the lobby.');
    }
  };

  // Helper to create a new public game (for rematch fallback)
  const handleCreatePublicGame = async () => {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
      const res = await axios.post(`${backendUrl}/game-requests`, {
        gameType: 'public',
        variantId: game.variant_id,
        boardSize: game.board_size,
      }, { withCredentials: true });
      navigate(`/game/${res.data.id}`);
    } catch (err) {
      console.error('Error creating public game:', err);
      setError(err.response?.data?.error || 'Failed to create game.');
    }
  };

  // Consolidated initialization - single source of truth
  useEffect(() => {
    if (!game) return;

    console.log(`[${new Date().toISOString()}] [GameBoard] Initializing from game prop:`, game);
    if (game.board) {
      const isBoardEmpty = Array.isArray(game.board) ? game.board.every(r => r.every(c => c === null)) : 'unknown';
      console.log(`[${new Date().toISOString()}] Game prop board empty?`, isBoardEmpty);
    }

    // Parse board if it's a string
    let parsedBoard = game.board;
    if (typeof parsedBoard === 'string') {
      try {
        parsedBoard = JSON.parse(parsedBoard);
      } catch (e) {
        console.error('[GameBoard] Failed to parse game.board:', e);
        parsedBoard = null;
      }
    }

    // Determine board state
    let initialBoard;
    if (parsedBoard && Array.isArray(parsedBoard) && parsedBoard.length > 0) {
      console.log('[GameBoard] Using existing board from game.board, length:', parsedBoard.length);
      initialBoard = parsedBoard;
    } else if (game.board_size) {
      console.log('[GameBoard] Creating empty board from game.board_size:', game.board_size);
      initialBoard = Array(game.board_size).fill(null).map(() => Array(game.board_size).fill(null));
    } else {
      console.warn('[GameBoard] No board or board_size, defaulting to 3x3');
      initialBoard = Array(3).fill(null).map(() => Array(3).fill(null));
    }

    const newSize = initialBoard.length;
    console.log('[GameBoard] Setting board and boardSize to:', newSize);

    setBoard(initialBoard);
    setBoardSize(newSize);

    // Handle cones
    let p1Cones = game.player1_cones || [3, 3, 3];
    let p2Cones = game.player2_cones || [3, 3, 3];

    if (typeof p1Cones === 'string') {
      try { p1Cones = JSON.parse(p1Cones); } catch (e) { console.error('Failed to parse p1Cones', e); }
    }
    if (typeof p2Cones === 'string') {
      try { p2Cones = JSON.parse(p2Cones); } catch (e) { console.error('Failed to parse p2Cones', e); }
    }

    setPlayer1Cones(p1Cones);
    setPlayer2Cones(p2Cones);
    setError(null);

    console.log('[GameBoard] Initialization complete. Board size:', newSize, 'Cones:', { p1Cones, p2Cones });
  }, [game]);

  // Fetch variant information (separate concern - doesn't update boardSize)
  useEffect(() => {
    const fetchVariant = async () => {
      if (game?.variant_id) {
        try {
          const backendUrl = process.env.REACT_APP_BACKEND_URL;
          const res = await axios.get(`${backendUrl}/variants/${game.variant_id}`);
          setVariant(res.data);
          console.log('[GameBoard] Fetched variant:', res.data);
        } catch (error) {
          console.error('[GameBoard] Error fetching variant:', error);
        }
      }
    };
    fetchVariant();
  }, [game?.variant_id]);

  // Auto-select cone size 0 for variants that don't allow overwrite (Classic, Gomoku)
  useEffect(() => {
    if (variant && !variant.rules?.allowOverwrite) {
      setSelectedCone1(0);
      setSelectedCone2(0);
    }
  }, [variant]);

  useEffect(() => {
    console.log(`[${new Date().toISOString()}] GameBoard Render. ActivePlayer:`, activePlayer, 'Type:', typeof activePlayer);
    console.log('Game Result:', gameResult, 'Winner:', winner);
    setError(null);
  }, [activePlayer, gameResult, winner, isDraw]);

  // Track last bot move and winning cells
  useEffect(() => {
    if (!game) return;

    // Track last bot move for highlighting (bot is always player 2)
    if (game.last_move && game.game_type === 'bot') {
      const lastMove = typeof game.last_move === 'string'
        ? JSON.parse(game.last_move)
        : game.last_move;

      // Only highlight if it was bot's move (active player changed to 1 = player's turn now)
      if (lastMove && activePlayer === 1) {
        setLastBotMove({ row: lastMove.row, col: lastMove.col });
      }
    }

    // Track winning cells from game state
    if ((winner || isDraw) && game.winning_cells) {
      const cells = typeof game.winning_cells === 'string'
        ? JSON.parse(game.winning_cells)
        : game.winning_cells;
      if (Array.isArray(cells)) {
        setWinningCells(cells);
      }
    }
  }, [game, activePlayer, winner, isDraw]);

  // Randomization Effect
  useEffect(() => {
    // Only randomize if:
    // 1. Game is active (joined/started)
    // 2. We haven't randomized yet for this component instance
    // 3. Game is not won or drawn
    // 4. Board is completely empty (no moves have been made yet)
    // 5. Game was created very recently (< 10 seconds ago)

    if (!game || game.status !== 'joined') return;
    if (hasRandomized || winner || isDraw) return;

    // CHECK: Only show animation if board is completely empty (fresh game)
    const isBoardEmpty = board.every(row => row.every(cell => cell === null));
    if (!isBoardEmpty) {
      console.log('Board has moves, skipping randomization animation');
      return;
    }

    // CHECK: Only show animation if game was just created (< 10 seconds ago) OR if we just transitioned from pending to joined
    // This prevents animation on hard refresh of older games, but ensures it runs when a player joins a waiting lobby
    const prevStatus = prevStatusRef.current;
    const isJustJoined = prevStatus === 'pending' && game.status === 'joined';

    if (game.created_at) {
      const createdAt = new Date(game.created_at);
      const now = new Date();
      const ageInSeconds = (now - createdAt) / 1000;

      if (ageInSeconds > 10 && !isJustJoined) {
        console.log(`Game is ${ageInSeconds.toFixed(1)} seconds old and not just joined (prev=${prevStatus}), skipping randomization animation`);
        return;
      }
      console.log(`Game is ${ageInSeconds.toFixed(1)} seconds old, showing randomization animation (isJustJoined=${isJustJoined})`);
    }

    // Start randomization immediately when game is joined
    console.log(`[${new Date().toISOString()}] Starting randomization animation...`);
    console.log('Creator name:', creatorName);
    console.log('Joiner name:', joinerName);
    console.log('Active player:', activePlayer);
    console.log('Current Board State:', JSON.stringify(board));

    // Freeze the current board state to prevent visual updates during animation
    console.log(`[${new Date().toISOString()}] Freezing board state. Is board empty?`, board.every(row => row.every(c => c === null)));

    // CRITICAL FIX: Instead of freezing the current 'board' (which might already have the bot move due to race conditions),
    // we explicitly create a fresh EMPTY board to show during the animation.
    // This guarantees the user sees an empty board regardless of socket update timing.
    const emptyBoard = Array(boardSize).fill(null).map(() => Array(boardSize).fill(null));
    setFrozenBoard(emptyBoard);

    setIsRandomizing(true);
    setHasRandomized(true);

    let interval;
    let counter = 0;
    // Use proper fallback names based on game type
    const player1Name = creatorName || 'Player 1';
    // Fallback: 'Bot AI' for bot games, 'Opponent' for PvP games
    const isBotGame = game?.game_type === 'bot';
    const player2Name = joinerName || (isBotGame ? 'Bot AI' : 'Opponent');
    const names = [player1Name, player2Name];
    console.log('Names array:', names, 'Game type:', game?.game_type);
    const duration = 1500; // 1.5 seconds total (reduced from 2s)
    const speed = 80; // Switch every 80ms (slightly faster)

    interval = setInterval(() => {
      const currentName = names[counter % 2];
      console.log('Setting name:', currentName);
      setRandomizingName(currentName);
      counter++;
    }, speed);

    // Stop animation and show winner
    setTimeout(() => {
      clearInterval(interval);
      const finalName = activePlayer === 1 ? player1Name : player2Name;
      console.log('Final name:', finalName);
      setRandomizingName(finalName);
      setShowFinalName(true);

      // Hide overlay after showing result
      setTimeout(() => {
        setIsRandomizing(false);
        setShowFinalName(false);
        setFrozenBoard(null); // Unfreeze board
      }, 1200); // Reduced from 1500ms
    }, duration);

    return () => clearInterval(interval);
  }, [game, hasRandomized, creatorName, joinerName, activePlayer, winner, isDraw, board, boardSize]);

  // Reset hasRandomized when game changes (e.g., "Play Again")
  useEffect(() => {
    if (game?.id) {
      setHasRandomized(false);
    }
  }, [game?.id]);

  // Update prevStatusRef
  useEffect(() => {
    prevStatusRef.current = game?.status;
  }, [game?.status]);

  const handleCellClick = async (row, col) => {
    // Block if already processing a move
    if (isSubmitting) {
      console.log('[Click] Blocked: Already submitting a move');
      return;
    }

    // Ensure that the game isn't won or drawn before this move
    if (winner) {
      setError('The game has already been won. No further moves can be made.');
      return;
    }

    if (isDraw) {
      setError('The game has ended in a draw. No further moves can be made.');
      return;
    }

    if (!game.joiner_id && game.game_type !== 'bot') {
      setError('The game cannot start without another player or has not yet started.');
      return;
    }

    // Check if it's the current user's turn
    const isPlayer1 = currentUser.user_id === game.creator_id;
    const isPlayer2 = currentUser.user_id === game.joiner_id;

    console.log(`[Click] User:${currentUser.user_id} Creator:${game.creator_id} Active:${activePlayer} (type:${typeof activePlayer}) isP1:${isPlayer1}`);
    console.log(`[Click] Validation: isP1=${isPlayer1} activePlayer=${activePlayer} check=${activePlayer !== 1}`);

    if (isPlayer1 && activePlayer !== 1) {
      console.warn(`BLOCKED: Player 1 but active is ${activePlayer} (type:${typeof activePlayer})`);
      setError('It is not your turn.');
      return;
    }

    if (isPlayer2 && activePlayer !== 2) {
      console.warn(`BLOCKED: Player 2 but active is ${activePlayer} (type:${typeof activePlayer})`);
      setError('It is not your turn.');
      return;
    }

    console.log('[Click] Turn validation PASSED');

    const selectedCone = activePlayer === 1 ? selectedCone1 : selectedCone2;
    const currentPlayerCones = activePlayer === 1 ? player1Cones : player2Cones;

    // Check if variant uses unlimited markers (single element array with value >= 900)
    const isUnlimitedMarker = currentPlayerCones.length === 1 && currentPlayerCones[0] >= 900;


    if (!isUnlimitedMarker && (!currentPlayerCones || currentPlayerCones[selectedCone] <= 0)) {
      setError(`Invalid move: Player ${activePlayer} has no cones of size ${selectedCone + 1} left.`);
      return;
    }


    console.log('[handleCellClick] About to validate move:', {
      row,
      col,
      selectedCone,
      selectedConeType: typeof selectedCone,
      cellValue: board[row][col],
      cellPlayer: board[row][col]?.player,
      cellSize: board[row][col]?.size,
      cellSizeType: typeof board[row][col]?.size,
      activePlayer
    });

    // Check if cone size allows overwriting (for variants with size rules)
    if (board[row][col] !== null && !canPlaceCone(board[row][col], selectedCone)) {
      setError('Invalid move: You can only place a larger cone over a smaller cone.');
      return;
    }



    const newBoard = board.map((r, rowIndex) =>
      r.map((cell, colIndex) => {
        if (rowIndex === row && colIndex === col) {
          return { player: activePlayer, size: selectedCone };
        }
        return cell;
      })
    );

    const newCones = [...currentPlayerCones];
    // Only decrement if not unlimited marker
    if (!isUnlimitedMarker) {
      newCones[selectedCone] -= 1;
    }

    try {
      console.log('Updating game with move:', { row, col, selectedCone });

      // Lock the board to prevent multiple clicks
      setIsSubmitting(true);

      // OPTIMISTIC UPDATE: Update UI immediately for responsive feel
      setBoard(newBoard);
      if (activePlayer === 1) {
        setPlayer1Cones(newCones);
      } else {
        setPlayer2Cones(newCones);
      }
      setError(null);

      // For bot games, show thinking indicator
      const isBotGame = game?.game_type === 'bot';
      if (isBotGame) {
        setIsBotThinking(true);
      }

      // IMPORTANT: Send ORIGINAL board state, let backend apply and validate the move
      // For bot games, this will wait for bot's response, but UI already updated optimistically
      await updateGame(board, activePlayer, player1Cones, player2Cones, row, col, selectedCone);

      // Backend response will update game state via socket, which will sync the board
      // The bot's move will come via socket update
    } catch (error) {
      console.error('Error updating game:', error.response?.data || error.message);
      // Revert optimistic update on error
      setBoard(board);
      if (activePlayer === 1) {
        setPlayer1Cones(player1Cones);
      } else {
        setPlayer2Cones(player2Cones);
      }
      setError(error.response?.data.error || error.message);
    } finally {
      // Always unlock the board when done
      setIsSubmitting(false);
      setIsBotThinking(false);
    }
  };

  const canPlaceCone = (cell, selectedCone) => {
    if (!cell) return true; // Empty cell always valid

    // Ensure numeric comparison (convert to numbers explicitly)
    const selectedSize = parseInt(selectedCone, 10);
    const cellSize = parseInt(cell.size, 10);

    console.log('[canPlaceCone] Checking move:', {
      selectedCone: selectedSize,
      cellSize: cellSize,
      cellPlayer: cell.player,
      activePlayer,
      variantLoaded: !!variant,
      allowOverwrite: variant?.rules?.allowOverwrite,
      overwriteRules: variant?.rules?.overwriteRules
    });

    // Check variant rules for overwrite
    if (variant?.rules?.allowOverwrite) {
      if (variant.rules.overwriteRules === 'larger_or_same_size') {
        // Conquer Same-Size: allow equal or larger
        const result = selectedSize >= cellSize;
        console.log('[canPlaceCone] larger_or_same_size rule:', result, `${selectedSize} >= ${cellSize}`);
        return result;
      } else if (variant.rules.overwriteRules === 'larger_cone_only') {
        // Conquer Classic: only larger
        const result = selectedSize > cellSize;
        console.log('[canPlaceCone] larger_cone_only rule:', result, `${selectedSize} > ${cellSize}`);
        return result;
      }
    }

    // Default: only if larger (fallback)
    const result = selectedSize > cellSize;
    console.log('[canPlaceCone] Fallback rule:', result, `${selectedSize} > ${cellSize}`);
    return result;
  };

  const handleSurrender = async () => {
    try {
      console.log('Surrendering game...');
      const res = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/game-requests/${game.id}/surrender`,
        {},
        { withCredentials: true }
      );
      setError(`Game has ended by surrender. Winner: Player ${res.data.winner}`);
      console.log('Surrender response:', res.data);
    } catch (error) {
      console.error('Error surrendering:', error.response?.data || error.message);
      setError(error.response?.data.error || error.message);
    }
  };

  const renderCell = (row, col) => {
    const currentBoard = frozenBoard || board;
    const cellValue = currentBoard[row][col];
    let cellClass = 'cell';
    let coneSizeClass = '';

    // Check if this is Classic Tic-Tac-Toe (variant ID 1)
    const isClassicTicTacToe = game?.variant_id === 1;

    // Check if this cell is part of the winning line
    const isWinningCell = winningCells.some(c => c.row === row && c.col === col);
    if (isWinningCell) {
      cellClass += ' winning-cell';
    }

    // Check if this is the last bot move
    const isLastBotMoveCell = lastBotMove && lastBotMove.row === row && lastBotMove.col === col;
    if (isLastBotMoveCell) {
      cellClass += ' last-move';
    }

    if (cellValue) {
      const { player, size } = cellValue;
      if (player === 1) cellClass += ' player1';
      if (player === 2) cellClass += ' player2';

      switch (size) {
        case 0:
          coneSizeClass = 'board-small';
          break;
        case 1:
          coneSizeClass = 'board-medium';
          break;
        case 2:
          coneSizeClass = 'board-large';
          break;
        default:
          break;
      }
    }

    // Determine who started first for X/O assignment in Classic Tic-Tac-Toe
    // Derive strictly from server state (game.board and game.active_player) to ensure stability
    let firstPlayer = 1; // default
    if (isClassicTicTacToe && game) {
      let player1Moves = 0;
      let player2Moves = 0;

      // Parse game.board if it's a string
      let gameBoard = game.board;
      if (typeof gameBoard === 'string') {
        try {
          gameBoard = JSON.parse(gameBoard);
        } catch (e) {
          // Ignore parse error, default to 0-0
        }
      }

      if (gameBoard && Array.isArray(gameBoard)) {
        gameBoard.forEach(row => {
          row.forEach(cell => {
            if (cell && cell.player === 1) player1Moves++;
            if (cell && cell.player === 2) player2Moves++;
          });
        });
      }

      if (player1Moves > player2Moves) {
        // Player 1 has more moves -> P1 started
        firstPlayer = 1;
      } else if (player2Moves > player1Moves) {
        // Player 2 has more moves -> P2 started
        firstPlayer = 2;
      } else {
        // Equal moves (0-0, 1-1, etc.)
        // If moves are equal, it is the starting player's turn!
        // So starting player is whoever is currently active.
        firstPlayer = parseInt(game.active_player) || 1;
      }
    }

    return (
      <div
        key={`${row}-${col}`}
        className={cellClass}
        onClick={winner || isDraw ? null : () => handleCellClick(row, col)}
      >
        {cellValue && (
          isClassicTicTacToe ? (
            // Render X or O for Classic Tic-Tac-Toe
            // First player (whoever started) = X, second player = O
            <div className="xo-symbol">
              {cellValue.player === firstPlayer ? 'X' : 'O'}
            </div>
          ) : (
            // Render colored circles for other variants
            <div className={`circle ${coneSizeClass}`}></div>
          )
        )}
      </div>
    );
  };

  const renderRow = (row) => {
    const currentBoard = frozenBoard || board;
    return (
      <div key={row} className="row">
        {currentBoard[row].map((cell, col) => renderCell(row, col))}
      </div>
    );
  };

  const renderConeButton = (size, color, count, disabled, selected, onClick) => (
    <button
      className={`circle ${size} ${color} ${selected ? 'selected' : ''}`}
      onClick={winner || isDraw ? null : onClick}
      disabled={disabled || !!winner || isDraw}
    >
      <span className="cone-count">{count}</span>
    </button>
  );

  const renderGameResult = () => {
    // Only render the game result if the game has ended (winner or draw).
    // Otherwise, return null to indicate nothing should be rendered.
    if (!winner && !isDraw) return null;

    // Hide overlay when rematch modal is shown to prevent blocking button clicks
    if (showRematchModal) return null;

    // Show "View Result" button when overlay is dismissed
    if (!showResultOverlay) {
      return (
        <div className="result-minimized">
          <button className="view-result-button" onClick={() => setShowResultOverlay(true)}>
            View Game Result
          </button>
        </div>
      );
    }

    let message;
    let bannerClass = "winner-banner glass-panel"; // Default base class

    if (winner) {

      let winnerName;
      let isCurrentUserWinner;
      let isCurrentUserLoser;

      if (game.game_type === 'bot') {
        winnerName = winner == 1 ? creatorName : joinerName;
        isCurrentUserWinner = winner == 1;
        isCurrentUserLoser = winner == 2;
      } else {
        winnerName = winner === game.creator_id ? creatorName : joinerName;
        isCurrentUserWinner = currentUser?.user_id === winner;
        isCurrentUserLoser = currentUser?.user_id === (winner === game.creator_id ? game.joiner_id : game.creator_id);
      }

      if (isCurrentUserWinner) {
        message = `🎉 Congratulations! ${winnerName} wins! 🎉`;
        bannerClass += " win";
      } else if (isCurrentUserLoser) {
        message = `${winnerName} wins. Better luck next time!`;
        bannerClass += " loss";
      } else {
        message = `${winnerName} has won the game!`;
        bannerClass += " win";
      }

      if (gameResult === 'surrendered') {
        message += ` (Surrender)`;
      }
    } else {
      // Draw
      message = "The game has ended in a draw.";
      bannerClass = "draw-banner glass-panel draw";
    }

    return (
      <div className="game-result-overlay">
        <div className={bannerClass}>
          <button className="close-overlay-button" onClick={() => setShowResultOverlay(false)} aria-label="Close">
            <CloseIcon />
          </button>
          <div className="banner-message">{message}</div>
          <div className="play-again-container">
            <button className="play-again-button" onClick={handlePlayAgain}>
              Play Again
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="game-container">
      {/* Randomization Overlay */}
      {isRandomizing && (
        <div className="randomization-overlay">
          <div className="randomization-content">
            <div className="randomization-title">Randomizing Turn</div>
            {!showFinalName && <div className="randomization-spinner"></div>}
            <div className={`randomizing-name ${showFinalName ? 'final' : ''}`}>
              {randomizingName}
            </div>
            {showFinalName && <div className="randomization-subtitle">Starts the game!</div>}
          </div>
        </div>
      )}

      <div className="game-info">
        <div className={`player-info ${activePlayer === 1 ? 'active' : ''}`}>
          <strong>
            <span className="player-indicator player1-indicator">●</span> {creatorName}
          </strong>
          {(variant?.rules?.allowOverwrite) && (
            <div className="legend">
              <div className="legend-item">
                {renderConeButton('small', 'orange', player1Cones[0], activePlayer !== 1 || player1Cones[0] === 0, selectedCone1 === 0, () => setSelectedCone1(0))}
                <span className="splitter"></span>
                {renderConeButton('medium', 'orange', player1Cones[1], activePlayer !== 1 || player1Cones[1] === 0, selectedCone1 === 1, () => setSelectedCone1(1))}
                <span className="splitter"></span>
                {renderConeButton('large', 'orange', player1Cones[2], activePlayer !== 1 || player1Cones[2] === 0, selectedCone1 === 2, () => setSelectedCone1(2))}
              </div>
            </div>
          )}
        </div>
        <div className={`player-info ${activePlayer === 2 ? 'active' : ''}`}>
          <strong>
            <span className="player-indicator player2-indicator">●</span> {joinerName || (game?.game_type === 'bot' ? 'Bot AI' : 'Waiting...')}
          </strong>
          {(variant?.rules?.allowOverwrite) && (
            <div className="legend">
              <div className="legend-item">
                {renderConeButton('small', 'green', player2Cones[0], activePlayer !== 2 || player2Cones[0] === 0, selectedCone2 === 0, () => setSelectedCone2(0))}
                <span className="splitter"></span>
                {renderConeButton('medium', 'green', player2Cones[1], activePlayer !== 2 || player2Cones[1] === 0, selectedCone2 === 1, () => setSelectedCone2(1))}
                <span className="splitter"></span>
                {renderConeButton('large', 'green', player2Cones[2], activePlayer !== 2 || player2Cones[2] === 0, selectedCone2 === 2, () => setSelectedCone2(2))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Move Timer - only show for PvP games that are active */}
      {game?.game_type !== 'bot' && game?.joiner_id && !winner && !isDraw && game?.status === 'joined' && (
        <div className="timer-container">
          <MoveTimer
            lastMoveAt={game.last_move_at}
            timeoutSeconds={game.move_timeout_seconds || 300}
            isMyTurn={
              (currentUser?.user_id === game.creator_id && activePlayer === 1) ||
              (currentUser?.user_id === game.joiner_id && activePlayer === 2)
            }
            gameActive={game.status === 'joined'}
            onTimeout={handleTimeout}
          />
        </div>
      )}

      {/* Bot Thinking Indicator */}
      {isBotThinking && (
        <div className="bot-thinking-indicator">
          <div className="bot-thinking-spinner"></div>
          <span>Bot is thinking...</span>
        </div>
      )}

      <div
        key={boardSize} /* Force re-creation of DOM element when size changes to ensure grid style applies */
        className={`game-board ${boardSize > 10 ? 'large-board' : ''}`}
        style={{
          gridTemplateColumns: `repeat(${boardSize}, 1fr)`,
          maxWidth: 'fit-content',
          gap: boardSize >= 15 ? '5px' : '10px'
        }}
      >
        {(frozenBoard || board).map((row, rowIndex) => {
          if (rowIndex === 0) console.log(`[${new Date().toISOString()}] Rendering row 0. Using frozenBoard?`, !!frozenBoard);
          return renderRow(rowIndex);
        })}
      </div>
      <ErrorMessage message={error} />
      {renderGameResult()}
      {!winner && !isDraw && <button className="surrender-button" onClick={handleSurrender}>Surrender</button>}

      {/* Rematch Modal for PvP games - only show when game is finished */}
      {(winner || isDraw) && (
        <RematchModal
          socket={socket}
          gameId={game?.id}
          opponentId={currentUser?.user_id === game?.creator_id ? game?.joiner_id : game?.creator_id}
          opponentName={currentUser?.user_id === game?.creator_id ? joinerName : creatorName}
          currentUserId={currentUser?.user_id}
          variantId={game?.variant_id}
          onClose={() => {
            setShowRematchModal(false);
            setRematchReceivedState(null);

          }}
          onCreatePublicGame={handleCreatePublicGame}
          isVisible={showRematchModal}
          initialState={rematchReceivedState ? 'received' : null}
          initialRequesterName={rematchReceivedState?.requesterName || null}
        />
      )}
    </div>
  );
};

export default GameBoard;
