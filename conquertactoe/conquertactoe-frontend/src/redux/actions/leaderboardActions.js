import axios from '../../utils/api';

export const fetchLeaderboard = () => {
  return async dispatch => {
    try {
      const res = await axios.get('/leaderboard');
      console.log("Leaderboard Response:", res.data);
      dispatch({ type: 'FETCH_LEADERBOARD', payload: res.data });
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    }
  };
};
