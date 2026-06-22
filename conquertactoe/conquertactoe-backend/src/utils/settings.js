const pool = require('../config/db');

// Cache settings in memory with TTL
let settingsCache = null;
let lastFetch = 0;
const CACHE_TTL = 30000; // 30 seconds

/**
 * Fetch all settings from database
 */
async function getSettings(forceRefresh = false) {
    const now = Date.now();

    // Return cached settings if still valid
    if (!forceRefresh && settingsCache && (now - lastFetch) < CACHE_TTL) {
        return settingsCache;
    }

    try {
        const result = await pool.query('SELECT config_key, config_value FROM appconfig');

        // Convert to object format
        const settings = {};
        result.rows.forEach(row => {
            settings[row.config_key] = row.config_value;
        });

        settingsCache = settings;
        lastFetch = now;

        return settings;
    } catch (err) {
        console.error('Error fetching settings:', err);
        // Return cached settings if DB fails
        return settingsCache || {};
    }
}

/**
 * Get a specific setting value
 */
async function getSetting(key, defaultValue = null) {
    const settings = await getSettings();
    return settings[key] !== undefined ? settings[key] : defaultValue;
}

/**
 * Get boolean setting
 */
async function getBooleanSetting(key, defaultValue = false) {
    const value = await getSetting(key);
    if (value === null) return defaultValue;
    return value === 'true' || value === true;
}

/**
 * Get number setting
 */
async function getNumberSetting(key, defaultValue = 0) {
    const value = await getSetting(key);
    if (value === null) return defaultValue;
    return parseInt(value, 10) || defaultValue;
}

module.exports = {
    getSettings,
    getSetting,
    getBooleanSetting,
    getNumberSetting
};
