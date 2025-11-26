import { combineReducers } from 'redux';
import authReducer from './authReducer';
import leaderboardReducer from './leaderboardReducer';
import gameRequestReducer from './gameRequestReducer';
import gameVariantReducer from './gameVariantReducer';

const rootReducer = combineReducers({
  auth: authReducer,
  leaderboard: leaderboardReducer,
  gameRequests: gameRequestReducer,
  gameVariants: gameVariantReducer
});

export default rootReducer;
