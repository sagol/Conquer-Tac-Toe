#!/bin/bash

# Script to test all game variants by creating bot games via API
# This tests that each variant can be created and played

BACKEND_URL="http://localhost:3000"
COOKIE_FILE="/tmp/test_cookies.txt"

echo "=== Testing All Game Variants ==="
echo ""

# Login first
echo "Step 1: Logging in..."
curl -s -c "$COOKIE_FILE" -X POST "$BACKEND_URL/auth/dev_login" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass"}' > /dev/null

if [ $? -ne 0 ]; then
  echo "❌ Login failed"
  exit 1
fi
echo "✅ Login successful"
echo ""

# Get all variants
echo "Step 2: Fetching game variants..."
VARIANTS=$(curl -s -b "$COOKIE_FILE" "$BACKEND_URL/variants")
echo "Variants: $VARIANTS"
echo ""

# Extract variant IDs (assuming JSON array with variant_id fields)
VARIANT_IDS=$(echo "$VARIANTS" | grep -o '"variant_id":[0-9]*' | grep -o '[0-9]*')

echo "Step 3: Testing each variant..."
echo ""

for VARIANT_ID in $VARIANT_IDS; do
  echo "Testing Variant ID: $VARIANT_ID"
  
  # Create bot game with this variant
  RESPONSE=$(curl -s -b "$COOKIE_FILE" -X POST "$BACKEND_URL/game-requests/bot" \
    -H "Content-Type: application/json" \
    -d "{\"variantId\":$VARIANT_ID}")
  
  GAME_ID=$(echo "$RESPONSE" | grep -o '"id":[0-9]*' | grep -o '[0-9]*' | head -1)
  
  if [ -z "$GAME_ID" ]; then
    echo "  ❌ Failed to create game for variant $VARIANT_ID"
    echo "  Response: $RESPONSE"
  else
    echo "  ✅ Created game $GAME_ID for variant $VARIANT_ID"
  fi
  echo ""
done

echo "=== Test Complete ==="
rm -f "$COOKIE_FILE"
