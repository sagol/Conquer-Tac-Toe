// Automated UI Test for Game Variant Dropdown
// This test verifies that the dropdown works correctly with automation tools
// 
// Prerequisites:
// - npm install -D playwright
// - npx playwright install chromium
//
// Run with: npx playwright test ui-dropdown-test.js --headed

const { test, expect } = require('@playwright/test');

test.describe('Game Variant Dropdown Automation Test', () => {
    test('should create a game using the dropdown and test IDs', async ({ page }) => {
        // Navigate to the application
        await page.goto('http://localhost:3001');

        console.log('✓ Navigated to application');

        // Wait for the app to load
        await page.waitForLoadState('networkidle');

        // Check if we need to login
        const loginButton = await page.getByText('Login with Google').first();
        if (await loginButton.isVisible()) {
            console.log('⚠ Login required - please login manually and rerun the test');
            console.log('  Or skip authentication for testing purposes');
            // For testing, we might skip this if there's a test user
        }

        // Navigate to Lobby (assuming we're logged in or on home page)
        const lobbyLink = await page.getByText('Lobby').first();
        if (await lobbyLink.isVisible()) {
            await lobbyLink.click();
            console.log('✓ Clicked Lobby link');
        }

        // Wait for lobby to load
        await page.waitForTimeout(1000);

        // Click Create Game Request button using test ID
        const createButton = await page.getByTestId('create-game-request-button');
        await expect(createButton).toBeVisible();
        await createButton.click();
        console.log('✓ Opened Create Game modal');

        // Wait for modal to appear
        await page.waitForTimeout(500);

        // Click the game variant dropdown using test ID
        const variantSelect = await page.getByTestId('game-variant-select');
        await expect(variantSelect).toBeVisible();
        await variantSelect.click();
        console.log('✓ Clicked game variant dropdown');

        // Wait for dropdown menu to appear
        await page.waitForTimeout(1000);

        // Take screenshot of open dropdown
        await page.screenshot({ path: 'dropdown-open.png' });
        console.log('✓ Screenshot saved: dropdown-open.png');

        // Select the first variant option
        // Material-UI renders options in a portal, so we need to find them differently
        const firstVariantOption = await page.locator('[data-testid^="variant-option-"]').first();
        await expect(firstVariantOption).toBeVisible();
        await firstVariantOption.click();
        console.log('✓ Selected game variant');

        // Wait for selection to register
        await page.waitForTimeout(500);

        // Select "Play vs AI Bot" radio button using test ID
        const botRadio = await page.getByTestId('game-type-bot');
        await expect(botRadio).toBeVisible();
        await botRadio.click();
        console.log('✓ Selected AI bot game type');

        // Take screenshot before creating game
        await page.screenshot({ path: 'before-create.png' });
        console.log('✓ Screenshot saved: before-create.png');

        // Click Create Game button using test ID
        const createGameButton = await page.getByTestId('create-game-button');
        await expect(createGameButton).toBeVisible();
        await createGameButton.click();
        console.log('✓ Clicked Create Game button');

        // Wait for navigation to game page
        await page.waitForTimeout(2000);

        // Take final screenshot
        await page.screenshot({ path: 'game-page.png' });
        console.log('✓ Screenshot saved: game-page.png');

        // Verify we're on a game page (URL should contain /game/)
        const currentUrl = page.url();
        expect(currentUrl).toContain('/game/');
        console.log(`✓ Successfully navigated to game page: ${currentUrl}`);

        console.log('\n✅ ALL TESTS PASSED! The dropdown automation fix is working correctly.');
    });
});
