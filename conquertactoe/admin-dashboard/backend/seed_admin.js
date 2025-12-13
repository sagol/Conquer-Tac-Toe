const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const logger = require('./utils/logger');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const createAdminTable = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Create AdminUsers table
        await client.query(`
            CREATE TABLE IF NOT EXISTS "AdminUsers" (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'admin',
                created_at TIMESTAMP DEFAULT NOW(),
                last_login TIMESTAMP
            );
        `);

        // Check if super admin exists
        const res = await client.query('SELECT * FROM "AdminUsers" WHERE email = $1', ['admin@conquertactoe.com']);

        if (res.rows.length === 0) {
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash('admin123', salt); // Default password

            await client.query(`
                INSERT INTO "AdminUsers" (username, email, password_hash, role)
                VALUES ($1, $2, $3, $4)
            `, ['SuperAdmin', 'admin@conquertactoe.com', hash, 'super_admin']);

            logger.info('Default super admin created: admin@conquertactoe.com / admin123');
        } else {
            logger.info('Super admin already exists');
        }

        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        logger.error('Error seeding admin user:', e);
        throw e;
    } finally {
        client.release();
    }
};

createAdminTable().then(() => {
    logger.info('Admin seeding completed');
    process.exit(0);
}).catch(err => {
    logger.error('Admin seeding failed', err);
    process.exit(1);
});
