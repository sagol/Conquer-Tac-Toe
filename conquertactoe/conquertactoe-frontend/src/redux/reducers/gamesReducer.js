const initialState = {
    games: [],
    currentGame: null,
    moves: []
  };
  
  const gamesReducer = (state = initialState, action) => {
    switch (action.type) {
      case 'FETCH_ALL_GAMES':
        return {
          ...state,
          games: action.payload
        };
      case 'FETCH_GAME':
        return {
          ...state,
          currentGame: action.payload
        };
      case 'FETCH_GAME_MOVES':
        return {
          ...state,
          moves: action.payload
        };
      case 'CREATE_GAME':
        return {
          ...state,
          games: [...state.games, action.payload]
        };
      case 'MAKE_MOVE':
        return {
          ...state,
          moves: [...state.moves, action.payload]
        };
      case 'END_GAME':
        return {
          ...state,
          games: state.games.map(game => 
            game.game_id === action.payload.game_id ? action.payload : game
          )
        };
      default:
        return state;
    }
  };
  
  export default gamesReducer;
  