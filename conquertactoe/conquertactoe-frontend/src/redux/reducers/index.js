import { combineReducers } from 'redux';
import gamesReducer from './gamesReducer';
import leaderboardReducer from './leaderboardReducer';
import authReducer from './authReducer';
// Import other reducers as needed

export default combineReducers({
  games: gamesReducer,
  leaderboard: leaderboardReducer,
  auth: authReducer,
  // Add other reducers here if needed
});
