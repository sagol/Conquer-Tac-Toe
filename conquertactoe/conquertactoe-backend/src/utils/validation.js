/**
 * Validates if a user ID is valid (number or numeric string).
 * @param {any} userId 
 * @returns {boolean}
 */
const isValidUserId = (userId) => {
    const num = typeof userId === 'number' ? userId : (typeof userId === 'string' ? Number(userId) : NaN);
    return Number.isInteger(num) && num > 0;
};

module.exports = {
    isValidUserId
};
