/**
 * Validates if a user ID is valid (number or numeric string).
 * @param {any} userId 
 * @returns {boolean}
 */
const isValidUserId = (userId) => {
    return userId && (typeof userId === 'number' || (typeof userId === 'string' && !isNaN(parseInt(userId)) && Number.isInteger(Number(userId))));
};

module.exports = {
    isValidUserId
};
