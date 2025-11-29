const rateLimit = require('express-rate-limit');
const { getNumberSetting } = require('../utils/settings');

// Store the rate limiter instance
let limiter = null;
let currentLimit = 0;
let lastUpdate = 0;

// Wrapper function to make rate limiter dynamic
const dynamicRateLimiter = async (req, res, next) => {
    const now = Date.now();

    // Refresh setting every minute to avoid DB spam
    if (!limiter || (now - lastUpdate) > 60000) {
        const limit = await getNumberSetting('rate_limit_per_min', 100);

        // If limit changed or not initialized, create new limiter
        if (limit !== currentLimit) {
            currentLimit = limit;
            limiter = rateLimit({
                windowMs: 60 * 1000, // 1 minute
                max: limit,
                standardHeaders: true,
                legacyHeaders: false,
                message: { error: 'Too many requests, please try again later.' }
            });
            console.log(`[RateLimiter] Updated limit to ${limit} req/min`);
        }
        lastUpdate = now;
    }

    return limiter(req, res, next);
};

module.exports = dynamicRateLimiter;
