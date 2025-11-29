-- Admin Dashboard Database Schema
-- Run this migration before implementing the admin dashboard

-- 1. Add role column to Users table
ALTER TABLE Users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
ALTER TABLE Users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;
ALTER TABLE Users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
ALTER TABLE Users ADD COLUMN IF NOT EXISTS login_count INT DEFAULT 0;
ALTER TABLE Users ADD COLUMN IF NOT EXISTS password VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_users_role ON Users(role);
CREATE INDEX IF NOT EXISTS idx_users_banned ON Users(is_banned);

-- 2. Create AdminLogs table
CREATE TABLE IF NOT EXISTS AdminLogs (
    id SERIAL PRIMARY KEY,
    admin_id INT NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id INT,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON AdminLogs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON AdminLogs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON AdminLogs(action);

-- 3. Create UserBans table
CREATE TABLE IF NOT EXISTS UserBans (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    banned_by INT NOT NULL REFERENCES Users(user_id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    banned_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    is_permanent BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    unbanned_at TIMESTAMP,
    unbanned_by INT REFERENCES Users(user_id) ON DELETE SET NULL,
    unban_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_bans_user ON UserBans(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bans_active ON UserBans(is_active, expires_at);

-- 4. Create SystemLogs table
CREATE TABLE IF NOT EXISTS SystemLogs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(20) NOT NULL,
    service VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    stack_trace TEXT,
    metadata JSONB,
    user_id INT REFERENCES Users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_level ON SystemLogs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON SystemLogs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_service ON SystemLogs(service);

-- 5. Insert a default admin user (change password after first login!)
-- Password: admin123 (hashed with bcrypt)
INSERT INTO Users (username, email, password, role, created_at, updated_at, oauth_id)
VALUES (
    'admin',
    'admin@conquertactoe.com',
    '$2b$10$7gNMH4eSsExe9IrCkCUoluYvr47yN3TpDwir4nVCTHdwT0FpRyvoS',
    'super_admin',
    NOW(),
    NOW(),
    'admin-local'
)
ON CONFLICT (email) DO NOTHING;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Admin dashboard schema created successfully!';
    RAISE NOTICE 'Default admin user: admin@conquertactoe.com / admin123';
    RAISE NOTICE 'IMPORTANT: Change the admin password after first login!';
END $$;
