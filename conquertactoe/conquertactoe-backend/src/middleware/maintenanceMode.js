const { getBooleanSetting } = require('../utils/settings');

/**
 * Middleware to check if site is in maintenance mode
 */
async function maintenanceMode(req, res, next) {
    try {
        const isMaintenanceMode = await getBooleanSetting('maintenance_mode', false);

        if (isMaintenanceMode) {
            // Allow admin endpoints to pass through
            if (req.path.startsWith('/admin') || req.path === '/health') {
                return next();
            }

            return res.status(503).json({
                error: 'Site is currently under maintenance',
                message: 'We are performing scheduled maintenance. Please check back soon.'
            });
        }

        next();
    } catch (err) {
        // On error, allow request to proceed
        console.error('Maintenance mode check failed:', err);
        next();
    }
}

module.exports = maintenanceMode;
