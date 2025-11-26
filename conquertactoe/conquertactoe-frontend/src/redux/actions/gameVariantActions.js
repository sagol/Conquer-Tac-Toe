import axios from 'axios';

// Action Types
export const FETCH_VARIANTS_REQUEST = 'FETCH_VARIANTS_REQUEST';
export const FETCH_VARIANTS_SUCCESS = 'FETCH_VARIANTS_SUCCESS';
export const FETCH_VARIANTS_FAILURE = 'FETCH_VARIANTS_FAILURE';
export const SELECT_VARIANT = 'SELECT_VARIANT';

const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3000';

/**
 * Fetch all game variants from the API
 */
export const fetchGameVariants = () => async (dispatch) => {
    dispatch({ type: FETCH_VARIANTS_REQUEST });

    try {
        const response = await axios.get(`${backendUrl}/variants`, {
            withCredentials: true
        });

        dispatch({
            type: FETCH_VARIANTS_SUCCESS,
            payload: response.data
        });
    } catch (error) {
        console.error('Error fetching variants:', error);
        dispatch({
            type: FETCH_VARIANTS_FAILURE,
            payload: error.response?.data?.error || error.message
        });
    }
};

/**
 * Select a game variant
 * @param {number} variantId - The variant ID to select
 */
export const selectVariant = (variantId) => ({
    type: SELECT_VARIANT,
    payload: variantId
});
