import { combineReducers } from 'redux';
import authReducer from './authReducer';
import leaderboardReducer from './leaderboardReducer';
import gameRequestReducer from './gameRequestReducer';

const rootReducer = combineReducers({
  auth: authReducer,
  leaderboard: leaderboardReducer,
  gameRequests: gameRequestReducer
});

export default rootReducer;
