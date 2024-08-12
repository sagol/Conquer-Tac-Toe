import axios from 'axios';

export const addGameRequest = (gameRequest) => ({
  type: 'ADD_GAME_REQUEST',
  payload: gameRequest,
});

export const updateGameRequest = (gameRequest) => ({
  type: 'UPDATE_GAME_REQUEST',
  payload: gameRequest,
});

export const fetchActiveGameRequests = () => async dispatch => {
  try {
    const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/game-requests`, { withCredentials: true });
    dispatch({ 
      type: 'FETCH_ACTIVE_GAME_REQUESTS_SUCCESS', 
      payload: res.data.gameRequests,
      userStats: res.data.userStats // Pass user stats to the reducer
    });
  } catch (error) {
    dispatch({ type: 'FETCH_ACTIVE_GAME_REQUESTS_FAILURE', payload: error.response?.data || error.message });
  }
};
