import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchGames } from '../../redux/actions/gameActions';

const GameLobby = () => {
  const dispatch = useDispatch();
  const games = useSelector(state => state.games.games); // Ensure this matches your state structure

  useEffect(() => {
    dispatch(fetchGames());
  }, [dispatch]);

  return (
    <div>
      <h1>Game Lobby</h1>
      <ul>
        {games.map(game => (
          <li key={game.game_id}>{game.game_id}</li>
        ))}
      </ul>
    </div>
  );
};

export default GameLobby;
