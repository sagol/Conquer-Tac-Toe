const pool = require('../config/db');

/**
 * AppConfig Model
 * Handles database operations for application configuration
 */
class AppConfig {
    /**
     * Get all public configuration values
     * @returns {Promise<Object>} Key-value pairs of public configs
     */
    static async getPublicConfigs() {
        const result = await pool.query(
            'SELECT config_key, config_value FROM AppConfig WHERE is_public = true'
        );

        // Convert to key-value object
        const configs = {};
        result.rows.forEach(row => {
            configs[row.config_key] = row.config_value;
        });

        return configs;
    }

    /**
     * Get a specific config by key
     * @param {string} key - The config key
     * @returns {Promise<Object|null>} Config object or null if not found
     */
    static async getByKey(key) {
        const result = await pool.query(
            'SELECT * FROM AppConfig WHERE config_key = $1',
            [key]
        );
        return result.rows[0] || null;
    }

    /**
     * Update a config value (admin only - future use)
     * @param {string} key - The config key
     * @param {string} value - The new value
     * @returns {Promise<Object>} Updated config
     */
    static async update(key, value) {
        const result = await pool.query(
            `UPDATE AppConfig 
             SET config_value = $1, updated_at = NOW() 
             WHERE config_key = $2 
             RETURNING *`,
            [value, key]
        );
        return result.rows[0];
    }

    /**
     * Create a new config (admin only - future use)
     * @param {Object} configData - Config data
     * @returns {Promise<Object>} Created config
     */
    static async create(configData) {
        const { config_key, config_value, is_public, description } = configData;

        const result = await pool.query(
            `INSERT INTO AppConfig (config_key, config_value, is_public, description)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [config_key, config_value, is_public, description]
        );

        return result.rows[0];
    }
}

module.exports = AppConfig;
