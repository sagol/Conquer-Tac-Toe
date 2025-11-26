#!/bin/bash
# Manual Verification Steps for Game Variant Dropdown Fix

echo "========================================="
echo "Manual Verification Guide"
echo "========================================="
echo ""
echo "1. Open browser and navigate to: http://localhost:3001"
echo ""
echo "2. Login to the application (if not already logged in)"
echo ""
echo "3. Navigate to the Lobby"
echo ""
echo "4. Click 'Create Game Request' button"
echo ""
echo "5. In the Create Game Modal:"
echo "   - Open browser DevTools (F12)"
echo "   - Go to Elements/Inspector tab"
echo "   - Click on the Game Variant dropdown"
echo "   - Verify the dropdown opens and shows options"
echo ""
echo "6. Check for data-testid attributes:"
echo "   - The Select should have data-testid='game-variant-select'"
echo "   - Menu items should have data-testid='variant-option-[name]'"
echo "   - Radio buttons should have data-testid='game-type-public' and 'game-type-bot'"
echo "   - Buttons should have data-testid='create-game-button' and 'cancel-button'"
echo ""
echo "========================================="
echo "Automated Test ID Verification"
echo "========================================="
echo ""
echo "Checking if test IDs are present in the built files..."
echo ""

# Check if the compiled JS contains our test IDs
if grep -q "data-testid.*game-variant-select" /Users/sagol/Development/Projects/Conquer-Tac-Toe/Conquer-Tac-Toe/conquertactoe/conquertactoe-frontend/src/components/Lobby/CreateGameModal.js; then
    echo "✓ Source file contains game-variant-select test ID"
else
    echo "✗ Source file missing game-variant-select test ID"
fi

if grep -q "data-testid.*variant-option" /Users/sagol/Development/Projects/Conquer-Tac-Toe/Conquer-Tac-Toe/conquertactoe/conquertactoe-frontend/src/components/Lobby/CreateGameModal.js; then
    echo "✓ Source file contains variant-option test IDs"
else
    echo "✗ Source file missing variant-option test IDs"
fi

if grep -q "data-testid.*game-type-bot" /Users/sagol/Development/Projects/Conquer-Tac-Toe/Conquer-Tac-Toe/conquertactoe/conquertactoe-frontend/src/components/Lobby/CreateGameModal.js; then
    echo "✓ Source file contains game-type-bot test ID"
else
    echo "✗ Source file missing game-type-bot test ID"
fi

if grep -q "data-testid.*create-game-button" /Users/sagol/Development/Projects/Conquer-Tac-Toe/Conquer-Tac-Toe/conquertactoe/conquertactoe-frontend/src/components/Lobby/CreateGameModal.js; then
    echo "✓ Source file contains create-game-button test ID"
else
    echo "✗ Source file missing create-game-button test ID"
fi

echo ""
echo "========================================="
echo "Next Steps"
echo "========================================="
echo "Since the React app is running in a Docker container,"
echo "you may need to rebuild the container to see the changes:"
echo ""
echo "  cd /Users/sagol/Development/Projects/Conquer-Tac-Toe/Conquer-Tac-Toe/conquertactoe"
echo "  docker-compose down"
echo "  docker-compose up --build -d"
echo ""
echo "Or just restart the frontend container (already done):"
echo "  docker restart conquertactoe_frontend"
echo ""
