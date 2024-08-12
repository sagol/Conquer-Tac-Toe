import React from 'react';
import { Link } from 'react-router-dom';
import './GameRequest.css';

const GameRequest = ({ gameRequest }) => {
  return (
    <div className="game-request">
      <h2>Game Request #{gameRequest.id}</h2>
      <p>Creator: {gameRequest.creator_id}</p>
      {gameRequest.joiner_id ? (
        <p>Joiner: {gameRequest.joiner_id}</p>
      ) : (
        <p>Waiting for a player to join...</p>
      )}
      <Link to={`/game/${gameRequest.id}`}>Go to Game</Link>
    </div>
  );
};

export default GameRequest;
