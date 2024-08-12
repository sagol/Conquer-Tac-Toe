const initialState = {
  leaderboard: []
};

const leaderboardReducer = (state = initialState, action) => {
  switch (action.type) {
    case 'FETCH_LEADERBOARD':
      return { ...state, leaderboard: action.payload };
    default:
      return state;
  }
};

export default leaderboardReducer;
