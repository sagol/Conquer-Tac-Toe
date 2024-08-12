const initialState = {
  gameRequests: [],
  userStats: { wins: 0, losses: 0, draws: 0 }
};

const gameRequestReducer = (state = initialState, action) => {
  switch (action.type) {
    case 'FETCH_ACTIVE_GAME_REQUESTS_SUCCESS':
      return {
        ...state,
        gameRequests: action.payload,
        userStats: action.userStats // Update state with user stats
      };
    case 'FETCH_ACTIVE_GAME_REQUESTS_FAILURE':
      return state;
    case 'ADD_GAME_REQUEST':
      return {
        ...state,
        gameRequests: [...state.gameRequests, action.payload],
      };
    case 'UPDATE_GAME_REQUEST':
      return {
        ...state,
        gameRequests: state.gameRequests.map(request => request.id === action.payload.id ? action.payload : request),
      };
    case 'REMOVE_GAME_REQUEST':
      return {
        ...state,
        gameRequests: state.gameRequests.filter(request => request.id !== action.payload),
      };
    default:
      return state;
  }
};

export default gameRequestReducer;
