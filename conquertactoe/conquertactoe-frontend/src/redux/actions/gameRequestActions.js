import axios from 'axios';

export const addGameRequest = (gameRequest) => ({
  type: 'ADD_GAME_REQUEST',
  payload: gameRequest,
});

export const updateGameRequest = (gameRequest) => ({
  type: 'UPDATE_GAME_REQUEST',
  payload: gameRequest,
});

export const fetchActiveGameRequests = (page = 1) => async dispatch => {
  try {
    const limit = 25;
    const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/game-requests?page=${page}&limit=${limit}`, { withCredentials: true });
    const totalGames = res.data.totalGames; // Retrieve total game count from the server
    
    dispatch({
      type: 'FETCH_ACTIVE_GAME_REQUESTS_SUCCESS', 
      payload: res.data.gameRequests,
      userStats: res.data.userStats,
      totalPages: Math.ceil(totalGames / limit), // Calculate total pages
    });
  } catch (error) {
    dispatch({ type: 'FETCH_ACTIVE_GAME_REQUESTS_FAILURE', payload: error.response?.data || error.message });
  }
};
