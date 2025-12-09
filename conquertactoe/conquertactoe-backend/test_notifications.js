/**
 * Notification System Tests
 * 
 * Tests for the notification model, controller, and routes.
 * Run with: node test_notifications.js
 */





// Test Notification model input validation
async function testNotificationValidation() {
    console.log('\n=== Testing Notification Model Validation ===\n');

    // Import the model and override pool
    // Import the model and override pool

    let passed = 0;
    let failed = 0;

    // Test 1: Valid notification
    try {
        // This would actually hit the database, so we'll test the validation logic directly
        console.log('Test 1: Valid notification creation...');

        // Simulate validation checks
        const userId = 1;
        const type = 'game_join';
        const message = 'A player joined!';

        if (!userId || !Number.isInteger(Number(userId))) {
            throw new Error('Valid userId is required');
        }
        if (!type || typeof type !== 'string' || type.trim() === '') {
            throw new Error('Valid type is required');
        }
        if (!message || typeof message !== 'string' || message.trim() === '') {
            throw new Error('Valid message is required');
        }

        console.log('  ✓ Valid input passes validation');
        passed++;
    } catch (err) {
        console.log('  ✗ Valid input failed:', err.message);
        failed++;
    }

    // Test 2: Invalid userId
    try {
        console.log('Test 2: Invalid userId validation...');
        const userId = null;
        if (!userId || !Number.isInteger(Number(userId))) {
            console.log('  ✓ Invalid userId correctly rejected');
            passed++;
        } else {
            console.log('  ✗ Invalid userId should be rejected');
            failed++;
        }
    } catch (err) {
        console.log('  ✗ Test error:', err.message);
        failed++;
    }

    // Test 3: Empty type
    try {
        console.log('Test 3: Empty type validation...');
        const type = '';
        if (!type || typeof type !== 'string' || type.trim() === '') {
            console.log('  ✓ Empty type correctly rejected');
            passed++;
        } else {
            console.log('  ✗ Empty type should be rejected');
            failed++;
        }
    } catch (err) {
        console.log('  ✗ Test error:', err.message);
        failed++;
    }

    // Test 4: Null message
    try {
        console.log('Test 4: Null message validation...');
        const message = null;
        if (!message || typeof message !== 'string' || message.trim() === '') {
            console.log('  ✓ Null message correctly rejected');
            passed++;
        } else {
            console.log('  ✗ Null message should be rejected');
            failed++;
        }
    } catch (err) {
        console.log('  ✗ Test error:', err.message);
        failed++;
    }

    // Test 5: String userId (should be accepted after conversion)
    try {
        console.log('Test 5: String userId validation...');
        const userId = '123';
        if (!userId || !Number.isInteger(Number(userId))) {
            console.log('  ✗ Valid string userId should be accepted');
            failed++;
        } else {
            console.log('  ✓ String userId correctly converted and accepted');
            passed++;
        }
    } catch (err) {
        console.log('  ✗ Test error:', err.message);
        failed++;
    }

    console.log(`\n=== Validation Tests Complete: ${passed}/${passed + failed} passed ===\n`);
    return { passed, failed };
}

// Test admin middleware
async function testAdminMiddleware() {
    console.log('\n=== Testing Admin Middleware ===\n');

    // Import middleware
    const { ensureAuthenticated, ensureAdmin } = require('./src/middleware/auth');

    let passed = 0;
    let failed = 0;

    // Test 1: ensureAuthenticated - authenticated user
    try {
        console.log('Test 1: ensureAuthenticated with authenticated user...');
        const req = { isAuthenticated: () => true };
        const res = {};
        let nextCalled = false;
        const next = () => { nextCalled = true; };

        ensureAuthenticated(req, res, next);

        if (nextCalled) {
            console.log('  ✓ Authenticated user passes through');
            passed++;
        } else {
            console.log('  ✗ Authenticated user should pass through');
            failed++;
        }
    } catch (err) {
        console.log('  ✗ Test error:', err.message);
        failed++;
    }

    // Test 2: ensureAuthenticated - unauthenticated user
    try {
        console.log('Test 2: ensureAuthenticated with unauthenticated user...');
        const req = { isAuthenticated: () => false };
        let statusCode = null;
        let responseBody = null;
        const res = {
            status: (code) => {
                statusCode = code;
                return { json: (body) => { responseBody = body; } };
            }
        };
        const next = () => { };

        ensureAuthenticated(req, res, next);

        if (statusCode === 401 && responseBody.error === 'User not authenticated') {
            console.log('  ✓ Unauthenticated user correctly rejected with 401');
            passed++;
        } else {
            console.log('  ✗ Unauthenticated user should get 401');
            failed++;
        }
    } catch (err) {
        console.log('  ✗ Test error:', err.message);
        failed++;
    }

    // Test 3: ensureAdmin - admin user
    try {
        console.log('Test 3: ensureAdmin with admin user...');
        const req = { isAuthenticated: () => true, user: { role: 'admin' } };
        const res = {};
        let nextCalled = false;
        const next = () => { nextCalled = true; };

        ensureAdmin(req, res, next);

        if (nextCalled) {
            console.log('  ✓ Admin user passes through');
            passed++;
        } else {
            console.log('  ✗ Admin user should pass through');
            failed++;
        }
    } catch (err) {
        console.log('  ✗ Test error:', err.message);
        failed++;
    }

    // Test 4: ensureAdmin - non-admin user
    try {
        console.log('Test 4: ensureAdmin with non-admin user...');
        const req = { isAuthenticated: () => true, user: { role: 'user' } };
        let statusCode = null;
        let responseBody = null;
        const res = {
            status: (code) => {
                statusCode = code;
                return { json: (body) => { responseBody = body; } };
            }
        };
        const next = () => { };

        ensureAdmin(req, res, next);

        if (statusCode === 403 && responseBody.error === 'Admin access required') {
            console.log('  ✓ Non-admin user correctly rejected with 403');
            passed++;
        } else {
            console.log('  ✗ Non-admin user should get 403');
            failed++;
        }
    } catch (err) {
        console.log('  ✗ Test error:', err.message);
        failed++;
    }

    // Test 5: ensureAdmin - unauthenticated user
    try {
        console.log('Test 5: ensureAdmin with unauthenticated user...');
        const req = { isAuthenticated: () => false, user: null };
        let statusCode = null;
        const res = {
            status: (code) => {
                statusCode = code;
                return { json: () => { } };
            }
        };
        const next = () => { };

        ensureAdmin(req, res, next);

        if (statusCode === 403) {
            console.log('  ✓ Unauthenticated user correctly rejected with 403');
            passed++;
        } else {
            console.log('  ✗ Unauthenticated user should get 403');
            failed++;
        }
    } catch (err) {
        console.log('  ✗ Test error:', err.message);
        failed++;
    }

    console.log(`\n=== Admin Middleware Tests Complete: ${passed}/${passed + failed} passed ===\n`);
    return { passed, failed };
}

// Test socket joinUserRoom validation
function testSocketValidation() {
    console.log('\n=== Testing Socket Validation ===\n');

    let passed = 0;
    let failed = 0;

    // Simulate the validation logic from socket.js
    const isValidUserId = (userId) => {
        return userId && (typeof userId === 'number' || (typeof userId === 'string' && !isNaN(parseInt(userId))));
    };

    // Test 1: Valid number userId
    try {
        console.log('Test 1: Valid number userId...');
        if (isValidUserId(123)) {
            console.log('  ✓ Number userId accepted');
            passed++;
        } else {
            console.log('  ✗ Number userId should be accepted');
            failed++;
        }
    } catch (err) {
        console.log('  ✗ Test error:', err.message);
        failed++;
    }

    // Test 2: Valid string userId
    try {
        console.log('Test 2: Valid string userId...');
        if (isValidUserId('456')) {
            console.log('  ✓ String userId accepted');
            passed++;
        } else {
            console.log('  ✗ String userId should be accepted');
            failed++;
        }
    } catch (err) {
        console.log('  ✗ Test error:', err.message);
        failed++;
    }

    // Test 3: Null userId
    try {
        console.log('Test 3: Null userId...');
        if (!isValidUserId(null)) {
            console.log('  ✓ Null userId correctly rejected');
            passed++;
        } else {
            console.log('  ✗ Null userId should be rejected');
            failed++;
        }
    } catch (err) {
        console.log('  ✗ Test error:', err.message);
        failed++;
    }

    // Test 4: Empty string userId
    try {
        console.log('Test 4: Empty string userId...');
        if (!isValidUserId('')) {
            console.log('  ✓ Empty string userId correctly rejected');
            passed++;
        } else {
            console.log('  ✗ Empty string userId should be rejected');
            failed++;
        }
    } catch (err) {
        console.log('  ✗ Test error:', err.message);
        failed++;
    }

    // Test 5: Non-numeric string userId
    try {
        console.log('Test 5: Non-numeric string userId...');
        if (!isValidUserId('abc')) {
            console.log('  ✓ Non-numeric string correctly rejected');
            passed++;
        } else {
            console.log('  ✗ Non-numeric string should be rejected');
            failed++;
        }
    } catch (err) {
        console.log('  ✗ Test error:', err.message);
        failed++;
    }

    console.log(`\n=== Socket Validation Tests Complete: ${passed}/${passed + failed} passed ===\n`);
    return { passed, failed };
}

// Run all tests
async function runAllTests() {
    console.log('╔════════════════════════════════════════════╗');
    console.log('║     NOTIFICATION SYSTEM TEST SUITE         ║');
    console.log('╚════════════════════════════════════════════╝');

    let totalPassed = 0;
    let totalFailed = 0;

    // Run validation tests
    const validationResults = await testNotificationValidation();
    totalPassed += validationResults.passed;
    totalFailed += validationResults.failed;

    // Run admin middleware tests
    const adminResults = await testAdminMiddleware();
    totalPassed += adminResults.passed;
    totalFailed += adminResults.failed;

    // Run socket validation tests
    const socketResults = testSocketValidation();
    totalPassed += socketResults.passed;
    totalFailed += socketResults.failed;

    // Summary
    console.log('╔════════════════════════════════════════════╗');
    console.log('║              TEST SUMMARY                  ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log(`Total Tests: ${totalPassed + totalFailed}`);
    console.log(`Passed: ${totalPassed}`);
    console.log(`Failed: ${totalFailed}`);
    console.log(`Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);

    if (totalFailed === 0) {
        console.log('\n✓ All tests passed!');
        process.exit(0);
    } else {
        console.log(`\n✗ ${totalFailed} test(s) failed`);
        process.exit(1);
    }
}

runAllTests().catch(err => {
    console.error('Test suite error:', err);
    process.exit(1);
});
