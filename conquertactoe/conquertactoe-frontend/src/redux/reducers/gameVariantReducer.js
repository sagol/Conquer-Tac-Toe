import {
    FETCH_VARIANTS_REQUEST,
    FETCH_VARIANTS_SUCCESS,
    FETCH_VARIANTS_FAILURE,
    SELECT_VARIANT
} from '../actions/gameVariantActions';

const initialState = {
    variants: [],
    selectedVariantId: 3, // Default to Classic Conquer-Tac-Toe
    loading: false,
    error: null
};

/**
 * Game Variant Reducer
 * Manages state for game variants
 */
export default function gameVariantReducer(state = initialState, action) {
    switch (action.type) {
        case FETCH_VARIANTS_REQUEST:
            return {
                ...state,
                loading: true,
                error: null
            };

        case FETCH_VARIANTS_SUCCESS:
            return {
                ...state,
                loading: false,
                variants: action.payload,
                error: null
            };

        case FETCH_VARIANTS_FAILURE:
            return {
                ...state,
                loading: false,
                error: action.payload
            };

        case SELECT_VARIANT:
            return {
                ...state,
                selectedVariantId: action.payload
            };

        default:
            return state;
    }
}
