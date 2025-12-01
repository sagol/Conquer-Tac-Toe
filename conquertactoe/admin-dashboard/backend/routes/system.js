const express = require('express');
const router = express.Router();
const os = require('os');
const fs = require('fs');
const path = require('path');

// GET /admin/system/health - System health and resources
router.get('/health', (req, res) => {
    const health = {
        uptime: process.uptime(),
        timestamp: Date.now(),
        loadavg: os.loadavg(),
        memory: {
            total: os.totalmem(),
            free: os.freemem(),
            used: os.totalmem() - os.freemem()
        },
        cpus: os.cpus().length
    };
    res.json(health);
});

// GET /admin/system/logs - Get recent system logs
router.get('/logs', (req, res) => {
    const logFile = path.join(__dirname, '../combined.log');

    if (!fs.existsSync(logFile)) {
        return res.json([]);
    }

    // Read last 100 lines (simple implementation)
    fs.readFile(logFile, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to read logs' });
        }

        const logs = data.trim().split('\n')
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch (e) {
                    return { message: line };
                }
            })
            .reverse()
            .slice(0, 100);

        res.json(logs);
    });
});

module.exports = router;
