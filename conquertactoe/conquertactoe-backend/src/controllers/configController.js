const AppConfig = require('../models/AppConfig');

/**
 * Get public configuration values
 * These configs are safe to expose to the frontend
 */
exports.getPublicConfigs = async (req, res) => {
    try {
        const configs = await AppConfig.getPublicConfigs();
        res.json(configs);
    } catch (error) {
        console.error('Error fetching public configs:', error);
        res.status(500).json({ error: 'Failed to fetch configuration' });
    }
};
