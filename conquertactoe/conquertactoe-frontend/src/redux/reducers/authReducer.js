const initialState = {
  user: null,
  isAuthenticated: false
};

const authReducer = (state = initialState, action) => {
  switch (action.type) {
    case 'FETCH_CURRENT_USER_SUCCESS':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true
      };
    case 'FETCH_CURRENT_USER_FAILURE':
      return {
        ...state,
        user: null,
        isAuthenticated: false
      };
    case 'LOGOUT_SUCCESS':
      return {
        ...state,
        user: null,
        isAuthenticated: false
      };
    default:
      return state;
  }
};

export default authReducer;
