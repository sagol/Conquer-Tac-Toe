const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://youruser:yourpassword@conquertactoe_db:5432/conquertactoe'
});

const defaultSettings = [
    // Development & Debugging
    { key: 'dev_logging', value: 'false', description: 'Enable verbose console logging in backend' },
    { key: 'debug_mode', value: 'false', description: 'Show detailed error messages to users' },

    // Site Operations
    { key: 'maintenance_mode', value: 'false', description: 'Temporarily disable the site (show maintenance page)' },
    { key: 'new_registrations', value: 'true', description: 'Enable/disable new user signups' },
    { key: 'game_creation', value: 'true', description: 'Enable/disable new game creation' },

    // Gameplay Settings - Bot Difficulty (per variant, all default to 'hard')
    { key: 'bot_difficulty_variant_1', value: 'hard', description: 'Default bot difficulty for Classic Tic-Tac-Toe (easy/medium/hard)' },
    { key: 'bot_difficulty_variant_2', value: 'hard', description: 'Default bot difficulty for Gomoku (easy/medium/hard)' },
    { key: 'bot_difficulty_variant_3', value: 'hard', description: 'Default bot difficulty for Conquer Classic (easy/medium/hard)' },
    { key: 'bot_difficulty_variant_4', value: 'hard', description: 'Default bot difficulty for Conquer Same-Size (easy/medium/hard)' },
    { key: 'bot_difficulty_variant_5', value: 'hard', description: 'Default bot difficulty for Conquer Custom (easy/medium/hard)' },
    { key: 'max_active_games_per_user', value: '10', description: 'Limit concurrent games per user' },

    // Performance & Security
    { key: 'rate_limit_per_min', value: '100', description: 'API rate limiting threshold (requests per minute)' },
    { key: 'session_timeout_minutes', value: '60', description: 'Auto-logout inactive users (minutes)' }
];

async function seedSettings() {
    console.log('Seeding appconfig table with default settings...');

    try {
        for (const setting of defaultSettings) {
            // Use INSERT ... ON CONFLICT to avoid duplicates
            await pool.query(`
                INSERT INTO appconfig (config_key, config_value, description, is_public) 
                VALUES ($1, $2, $3, false)
                ON CONFLICT (config_key) DO NOTHING
            `, [setting.key, setting.value, setting.description]);

            console.log(`✓ Seeded setting: ${setting.key}`);
        }

        console.log('✓ Settings seeding completed successfully!');
    } catch (err) {
        console.error('Error seeding settings:', err);
        throw err;
    } finally {
        await pool.end();
    }
}

seedSettings();
