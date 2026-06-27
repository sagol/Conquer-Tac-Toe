/**
 * Validates if a user ID is a valid positive integer (number or numeric string).
 * @param {any} userId - The user ID to validate. 
 * @returns {boolean} True if valid positive integer within safe range.
 */
const isValidUserId = (userId) => {
    const num = typeof userId === 'number' ? userId : (typeof userId === 'string' ? Number(userId) : NaN);
    return Number.isInteger(num) && num > 0 && num <= Number.MAX_SAFE_INTEGER;
};

/**
 * Validates a username: letters, numbers, spaces, underscores and hyphens only.
 */
const isValidUsername = (username) => {
    return typeof username === 'string' && /^[a-zA-Z0-9_ -]+$/.test(username);
};

module.exports = {
    isValidUserId,
    isValidUsername
};
