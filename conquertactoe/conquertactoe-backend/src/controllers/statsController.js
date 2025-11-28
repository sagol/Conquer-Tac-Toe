const Stats = require('../models/Stats');

// Get global statistics
exports.getGlobalStats = async (req, res) => {
    try {
        const stats = await Stats.getGlobalStats();
        res.json(stats);
    } catch (err) {
        console.error('Error in getGlobalStats:', err.message);
        res.status(500).json({ error: err.message });
    }
};
