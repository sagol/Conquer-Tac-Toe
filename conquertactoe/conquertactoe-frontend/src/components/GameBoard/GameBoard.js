import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../Common/SharedModernStyles.css';
import './GameBoard.css';
import ErrorMessage from '../ErrorMessage/ErrorMessage';

const GameBoard = ({ game, updateGame, creatorName, joinerName, winner, isDraw, gameResult, currentUser }) => {
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

  // Randomization State
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [randomizingName, setRandomizingName] = useState('');
  const [showFinalName, setShowFinalName] = useState(false);
  const [hasRandomized, setHasRandomized] = useState(false);
  const [frozenBoard, setFrozenBoard] = useState(null); // Holds empty board during randomization

  const handlePlayAgain = async () => {
    try {
      if (!game) return;

      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';

      // Determine game type
      // If current game is 'bot' type, play again as bot.
      // If current game is 'public', create new public game.
      // If current game type is missing, infer from joiner (if joiner is null or bot, assume bot?)
      // Safer to default to 'public' if unknown, but try to preserve 'bot'.

      const gameType = game.game_type || (game.joiner_id === null ? 'bot' : 'public');

      const gameData = {
        gameType: gameType,
        variantId: game.variant_id,
        boardSize: game.board_size,
        // Add other necessary fields if any (e.g. custom cones if supported)
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

  // Consolidated initialization - single source of truth
  useEffect(() => {
    if (!game) return;

    console.log(`[${new Date().toISOString()}] [GameBoard] Initializing from game prop:`, game);
    if (game && game.board) {
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

  // Randomization Effect
  useEffect(() => {
    // Only randomize if:
    // 1. Game is active (joined/started)
    // 2. We haven't randomized yet for this session
    // 3. Game is not won or drawn
    // 4. Board is completely empty (no moves have been made yet)
    // 5. Game was created very recently (< 10 seconds ago)
    // This ensures animation only shows on FIRST game start, not on re-entry or hard refresh

    if (!game || game.status !== 'joined') return;
    if (hasRandomized || winner || isDraw) return;

    // CHECK: Only show animation if board is completely empty (fresh game)
    const isBoardEmpty = board.every(row => row.every(cell => cell === null));
    if (!isBoardEmpty) {
      console.log('Board has moves, skipping randomization animation');
      return;
    }

    // CHECK: Only show animation if game was just created (< 10 seconds ago)
    // This prevents animation on hard refresh of older games
    if (game.created_at) {
      const createdAt = new Date(game.created_at);
      const now = new Date();
      const ageInSeconds = (now - createdAt) / 1000;

      if (ageInSeconds > 10) {
        console.log(`Game is ${ageInSeconds.toFixed(1)} seconds old, skipping randomization animation`);
        return;
      }
      console.log(`Game is ${ageInSeconds.toFixed(1)} seconds old, showing randomization animation`);
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
    // For bot games, player 2 is the bot, so use proper names
    const player1Name = creatorName || 'Player 1';
    const player2Name = joinerName || 'Bot';
    const names = [player1Name, player2Name];
    console.log('Names array:', names);
    const duration = 2000; // 2 seconds total
    const speed = 100; // Switch every 100ms

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
      }, 1500);
    }, duration);

    return () => clearInterval(interval);
  }, [game, hasRandomized, creatorName, joinerName, activePlayer, winner, isDraw, board, boardSize]);

  const handleCellClick = async (row, col) => {
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
      // IMPORTANT: Send ORIGINAL board state, let backend apply and validate the move
      await updateGame(board, activePlayer, player1Cones, player2Cones, row, col, selectedCone);
      setBoard(newBoard);
      // REMOVED: setActivePlayer(activePlayer === 1 ? 2 : 1);
      // activePlayer is now derived from game.active_player, backend will update it
      if (activePlayer === 1) {
        setPlayer1Cones(newCones);
      } else {
        setPlayer2Cones(newCones);
      }
      setError(null);
    } catch (error) {
      console.error('Error updating game:', error.response?.data || error.message);
      setError(error.response?.data.error || error.message);
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

    return (
      <div
        key={`${row}-${col}`}
        className={cellClass}
        onClick={winner || isDraw ? null : () => handleCellClick(row, col)}
      >
        {cellValue && <div className={`circle ${coneSizeClass}`}></div>}
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
    if (winner) {
      console.log('Rendering winner with details:', { winner, gameResult, gameType: game.game_type });

      // For bot games, winner is player number (1 or 2), not user_id
      let winnerName;
      let isCurrentUserWinner;
      let isCurrentUserLoser;

      console.log('Winner type:', typeof winner, 'Value:', winner);
      console.log('Game type:', game.game_type);

      if (game.game_type === 'bot') {
        // Bot game: winner is 1 (player) or 2 (bot)
        // Use loose equality (==) to handle string/number mismatch
        winnerName = winner == 1 ? creatorName : joinerName;
        isCurrentUserWinner = winner == 1;
        isCurrentUserLoser = winner == 2;
        console.log('Bot game logic:', { winnerName, isCurrentUserWinner, isCurrentUserLoser });
      } else {
        // PvP game: winner is user_id
        winnerName = winner === game.creator_id ? creatorName : joinerName;
        isCurrentUserWinner = currentUser?.user_id === winner;
        isCurrentUserLoser = currentUser?.user_id === (winner === game.creator_id ? game.joiner_id : game.creator_id);
      }

      let message;

      if (isCurrentUserWinner) {
        message = `🎉 Congratulations! ${winnerName} wins! 🎉`;
      } else if (isCurrentUserLoser) {
        message = `${winnerName} wins! Better luck next time.`;
      } else {
        message = `${winnerName} has won the game!`;
      }

      if (gameResult === 'surrendered') {
        message += ` The game was won by surrender.`;
      }

      return (
        <div className="winner-banner">
          {message}
          <div className="play-again-container">
            <button className="play-again-button" onClick={handlePlayAgain}>
              Play Again
            </button>
          </div>
        </div>
      );
    } else if (isDraw) {
      return (
        <div className="draw-banner">
          The game has ended in a draw.
          <div className="play-again-container">
            <button className="play-again-button" onClick={handlePlayAgain}>
              Play Again
            </button>
          </div>
        </div>
      );
    }

    return null;
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
            <span className="player-indicator player2-indicator">●</span> {joinerName}
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
    </div>
  );
};

export default GameBoard;
