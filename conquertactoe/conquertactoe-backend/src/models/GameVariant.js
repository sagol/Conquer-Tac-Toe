const pool = require('../config/db');

/**
 * GameVariant Model
 * Handles database operations for game variants
 */
class GameVariant {
    /**
     * Get all active game variants
     * @returns {Promise<Array>} List of active variants
     */
    static async getAll() {
        const result = await pool.query(
            'SELECT * FROM gamevariants WHERE is_active = true ORDER BY variant_id'
        );
        return result.rows;
    }

    /**
     * Get a specific variant by ID
     * @param {number} variantId - The variant ID
     * @returns {Promise<Object|null>} Variant details or null if not found
     */
    static async getById(variantId) {
        const result = await pool.query(
            'SELECT * FROM gamevariants WHERE variant_id = $1',
            [variantId]
        );
        return result.rows[0] || null;
    }

    /**
     * Get a variant by its unique name
     * @param {string} name - Variant name (e.g., 'conquer_classic')
     * @returns {Promise<Object|null>} variant details or null
     */
    static async getByName(name) {
        const result = await pool.query(
            'SELECT * FROM gamevariants WHERE name = $1',
            [name]
        );
        return result.rows[0] || null;
    }

    /**
     * Create a new game variant (admin only - future use)
     * @param {Object} variantData - Variant configuration
     * @returns {Promise<Object>} Created variant
     */
    static async create(variantData) {
        const {
            name,
            display_name,
            description,
            board_size,
            player1_cones,
            player2_cones,
            rules
        } = variantData;

        const result = await pool.query(
            `INSERT INTO gamevariants 
       (name, display_name, description, board_size, player1_cones, player2_cones, rules) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
            [
                name,
                display_name,
                description,
                board_size,
                JSON.stringify(player1_cones),
                JSON.stringify(player2_cones),
                JSON.stringify(rules)
            ]
        );
        return result.rows[0];
    }
}

module.exports = GameVariant;
