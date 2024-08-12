import axios from '../../utils/api';

export const fetchCurrentUser = () => async dispatch => {
  try {
    const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/current_user`, { withCredentials: true });
    dispatch({ type: 'FETCH_CURRENT_USER_SUCCESS', payload: res.data });
  } catch (error) {
    dispatch({ type: 'FETCH_CURRENT_USER_FAILURE', payload: error.response?.data || error.message });
  }
};

export const logoutUser = () => {
  return async dispatch => {
    try {
      const res = await axios.get('/logout');
      console.log("Logout Response:", res.data);
      dispatch({ type: 'LOGOUT_USER' });
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };
};
