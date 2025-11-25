const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

/**
 * Run database migrations and seed data
 * This script creates the GameVariants table and populates it with initial data
 */
async function runMigrations() {
    try {
        console.log('🚀 Starting database migrations...\n');

        // Read and execute migration files in order
        const migrations = [
            '001_create_game_variants.sql',
            '002_add_variant_to_game_requests.sql'
        ];

        for (const migration of migrations) {
            const filePath = path.join(__dirname, 'migrations', migration);
            if (!fs.existsSync(filePath)) {
                console.error(`❌ Migration file not found: ${migration}`);
                continue;
            }

            const sql = fs.readFileSync(filePath, 'utf8');
            console.log(`⏳ Executing ${migration}...`);
            await pool.query(sql);
            console.log(`✅ ${migration} completed\n`);
        }

        // Run seeds
        const seedPath = path.join(__dirname, 'seeds', '001_seed_game_variants.sql');
        if (fs.existsSync(seedPath)) {
            const seedSql = fs.readFileSync(seedPath, 'utf8');
            console.log('⏳ Seeding game variants...');
            await pool.query(seedSql);
            console.log('✅ Seed data inserted\n');
        }

        // Verify data
        const result = await pool.query('SELECT variant_id, display_name FROM GameVariants ORDER BY variant_id');
        console.log('📊 Game Variants in database:');
        result.rows.forEach(row => {
            console.log(`   ${row.variant_id}. ${row.display_name}`);
        });

        console.log('\n🎉 All migrations completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration error:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    runMigrations();
}

module.exports = { runMigrations };
