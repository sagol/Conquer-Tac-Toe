import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './GameBoard.css';
import ErrorMessage from '../ErrorMessage/ErrorMessage';

const GameBoard = ({ game, updateGame, creatorName, joinerName, winner, isDraw, gameResult, currentUser }) => {
  const [board, setBoard] = useState(Array(3).fill().map(() => Array(3).fill(null)));
  const [activePlayer, setActivePlayer] = useState(1);
  const [player1Cones, setPlayer1Cones] = useState([3, 3, 3]);
  const [player2Cones, setPlayer2Cones] = useState([3, 3, 3]);
  const [selectedCone1, setSelectedCone1] = useState(2);
  const [selectedCone2, setSelectedCone2] = useState(2);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('Game state updated in GameBoard component:', game);
    if (game) {
      console.log('Updating board and player details from game state.');
      setBoard(game.board && game.board.length ? game.board : Array(3).fill().map(() => Array(3).fill(null)));
      setActivePlayer(game.active_player || 1);
      setPlayer1Cones(game.player1_cones && game.player1_cones.length === 3 ? game.player1_cones : [3, 3, 3]);
      setPlayer2Cones(game.player2_cones && game.player2_cones.length === 3 ? game.player2_cones : [3, 3, 3]);
      console.log('Board, activePlayer, and cones updated in GameBoard');
      setError(null);
    }
  }, [game]);
  
  useEffect(() => {
    console.log('Active Player:', activePlayer);
    console.log('Game Result:', gameResult);
    console.log('Winner:', winner);
    console.log('Draw:', isDraw);
    setError(null);
  }, [activePlayer, gameResult, winner, isDraw]);

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
  
    if (game.status !== 'joined') {
      setError('The game cannot start without another player or has not yet started.');
      return;
    }

    // Ensure the player is allowed to make a move
    if (
      (activePlayer === 1 && currentUser.user_id !== game.creator_id) ||
      (activePlayer === 2 && currentUser.user_id !== game.joiner_id)
    ) {
      setError('It is not your turn.');
      return;
    }

    const selectedCone = activePlayer === 1 ? selectedCone1 : selectedCone2;
    const currentPlayerCones = activePlayer === 1 ? player1Cones : player2Cones;

    if (!currentPlayerCones || currentPlayerCones[selectedCone] <= 0) {
      setError(`Invalid move: Player ${activePlayer} has no cones of size ${selectedCone + 1} left.`);
      return;
    }

    if (board[row][col] !== null && !canPlaceCone(board[row][col], selectedCone)) {
      setError('Invalid move: You cannot place a smaller cone over a larger one.');
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
    newCones[selectedCone] -= 1;

    try {
      console.log('Updating game with move:', { row, col, selectedCone });
      await updateGame(newBoard, activePlayer, activePlayer === 1 ? newCones : player1Cones, activePlayer === 2 ? newCones : player2Cones, row, col, selectedCone);
      setBoard(newBoard);
      setActivePlayer(activePlayer === 1 ? 2 : 1);
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
    return !cell || selectedCone >= cell.size;
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
    const cellValue = board[row][col];
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
    return (
      <div key={row} className="row">
        {[0, 1, 2].map((col) => renderCell(row, col))}
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
      console.log('Rendering winner with details:', { winner, gameResult });
  
      const winnerName = winner === game.creator_id ? creatorName : joinerName;
      const isCurrentUserWinner = currentUser?.user_id === winner;
      const isCurrentUserLoser = currentUser?.user_id === (winner === game.creator_id ? game.joiner_id : game.creator_id);
  
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
        </div>
      );
    } else if (isDraw) {
      return (
        <div className="draw-banner">
          The game has ended in a draw.
        </div>
      );
    }

    return null;
  };

  return (
    <div className="game-container">
      <div className="game-info">
        <div className={`player-info ${activePlayer === 1 ? 'active' : ''}`}>
          <strong>{creatorName}</strong>
          <div className="legend">
            <div className="legend-item">
              {renderConeButton('small', 'orange', player1Cones[0], activePlayer !== 1 || player1Cones[0] === 0, selectedCone1 === 0, () => setSelectedCone1(0))}
              <span className="splitter"></span>
              {renderConeButton('medium', 'orange', player1Cones[1], activePlayer !== 1 || player1Cones[1] === 0, selectedCone1 === 1, () => setSelectedCone1(1))}
              <span className="splitter"></span>
              {renderConeButton('large', 'orange', player1Cones[2], activePlayer !== 1 || player1Cones[2] === 0, selectedCone1 === 2, () => setSelectedCone1(2))}
            </div>
          </div>
        </div>
        <div className={`player-info ${activePlayer === 2 ? 'active' : ''}`}>
          <strong>{joinerName}</strong>
          <div className="legend">
            <div className="legend-item">
              {renderConeButton('small', 'green', player2Cones[0], activePlayer !== 2 || player2Cones[0] === 0, selectedCone2 === 0, () => setSelectedCone2(0))}
              <span className="splitter"></span>
              {renderConeButton('medium', 'green', player2Cones[1], activePlayer !== 2 || player2Cones[1] === 0, selectedCone2 === 1, () => setSelectedCone2(1))}
              <span className="splitter"></span>
              {renderConeButton('large', 'green', player2Cones[2], activePlayer !== 2 || player2Cones[2] === 0, selectedCone2 === 2, () => setSelectedCone2(2))}
            </div>
          </div>
        </div>
      </div>
      <div className="game-board">
        {[0, 1, 2].map((row) => renderRow(row))}
      </div>
      <ErrorMessage message={error} />
      {renderGameResult()}
      {!winner && !isDraw && <button className="surrender-button" onClick={handleSurrender}>Surrender</button>}
    </div>
  );
};

export default GameBoard;
