const { ClickHouse } = require('clickhouse'); // Ensure this import exists

const clickhouse = new ClickHouse({
    // 1. Add http:// prefix
    url: `http://${process.env.CLICKHOUSE_HOST || 'conquertt_clickhouse'}`,

    port: process.env.CLICKHOUSE_HTTP_PORT || 8123,
    debug: false,

    // 2. Credentials
    basicAuth: {
        username: process.env.CLICKHOUSE_USER || 'default',
        password: process.env.CLICKHOUSE_PASSWORD || '',
    },

    isUseGzip: false,
    format: 'json',

    // 3. Database Selection (Important!)
    config: {
        database: process.env.CLICKHOUSE_DB || 'default',
    },
});

const DB_NAME = process.env.CLICKHOUSE_DB || 'default';

const init = async () => {
    try {
        console.log('Initializing ClickHouse connection...');
        // Check connection
        await clickhouse.query('SELECT 1').toPromise();
        console.log('Connected to ClickHouse');

        // Create table if not exists
        const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ${DB_NAME}.game_moves (
        game_id String,
        timestamp DateTime DEFAULT now(),
        board_state String,
        player_cones String,
        bot_cones String,
        move_row UInt8,
        move_col UInt8,
        move_size UInt8,
        difficulty String,
        variant_id UInt8 DEFAULT 3,
        board_size UInt8 DEFAULT 3
      ) ENGINE = MergeTree()
      ORDER BY (game_id, timestamp)
    `;
        await clickhouse.query(createTableQuery).toPromise();
        console.log('Game moves table initialized');

        // Add columns if they don't exist (migration)
        try {
            await clickhouse.query(`ALTER TABLE ${DB_NAME}.game_moves ADD COLUMN IF NOT EXISTS variant_id UInt8 DEFAULT 3`).toPromise();
            await clickhouse.query(`ALTER TABLE ${DB_NAME}.game_moves ADD COLUMN IF NOT EXISTS board_size UInt8 DEFAULT 3`).toPromise();
        } catch (err) {
            console.warn('Schema update warning:', err.message);
        }

    } catch (err) {
        console.error('Failed to initialize ClickHouse:', err);
    }
};

// Initialize on start
init();

const logMove = async (data) => {
    try {
        const {
            gameId,
            board,
            playerCones,
            botCones, // In PvP, this is Player 2's cones
            move,
            difficulty, // In PvP, this can be 'pvp' or 'human'
            variantId = 3,
            boardSize = 3
        } = data;

        const query = `
      INSERT INTO ${DB_NAME}.game_moves (
        game_id, board_state, player_cones, bot_cones, 
        move_row, move_col, move_size, 
        difficulty, variant_id, board_size
      ) VALUES (
        '${gameId}',
        '${JSON.stringify(board)}',
        '${JSON.stringify(playerCones)}',
        '${JSON.stringify(botCones)}',
        ${move.row},
        ${move.col},
        ${move.coneSize},
        '${difficulty}',
        ${variantId},
        ${boardSize}
      )
    `;

        await clickhouse.query(query).toPromise();
        console.log(`Logged move for game ${gameId} to ClickHouse`);
    } catch (err) {
        console.error('Failed to log move to ClickHouse:', err);
        // Don't throw, just log error so game flow isn't interrupted
    }
};

module.exports = {
    logMove,
    init
};
