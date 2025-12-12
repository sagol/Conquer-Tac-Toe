#!/bin/bash

# verify-env.sh - Verifies that all .env files have required parameters from .env.example files
# Usage: ./verify-env.sh

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/../conquertactoe"

echo "================================================"
echo "   Environment Variable Validation"
echo "================================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

VALIDATION_FAILED=0

# Function to check if .env exists and validate
validate_env() {
    local module_dir="$1"
    local module_name="$2"
    
    echo ""
    echo "Checking $module_name..."
    
    local env_example="$PROJECT_ROOT/$module_dir/.env.example"
    local env_file="$PROJECT_ROOT/$module_dir/.env"
    
    # Check if .env.example exists
    if [ ! -f "$env_example" ]; then
        echo -e "  ${YELLOW}⚠️  Warning: .env.example not found${NC}"
        return 0
    fi
    
    # Check if .env exists
    if [ ! -f "$env_file" ]; then
        echo -e "  ${RED}❌ Missing .env file${NC}"
        echo -e "  ${YELLOW}   Please create $env_file based on $env_example${NC}"
        VALIDATION_FAILED=1
        return 1
    fi
    
    # Extract variable names from .env.example (ignoring comments and empty lines)
    local missing_vars=()
    while IFS= read -r line; do
        # Skip comments and empty lines
        if [[ "$line" =~ ^[[:space:]]*# ]] || [[ -z "$line" ]]; then
            continue
        fi
        
        # Extract variable name (everything before =)
        var_name=$(echo "$line" | cut -d= -f1 | tr -d '[:space:]')
        
        if [ -n "$var_name" ]; then
            # Check if variable exists in .env file
            if ! grep -q "^${var_name}=" "$env_file"; then
                missing_vars+=("$var_name")
            fi
        fi
    done < "$env_example"
    
    # Report results
    if [ ${#missing_vars[@]} -eq 0 ]; then
        echo -e "  ${GREEN}✅ All required variables present${NC}"
        return 0
    else
        echo -e "  ${RED}❌ Missing variables:${NC}"
        for var in "${missing_vars[@]}"; do
            echo -e "     - $var"
        done
        VALIDATION_FAILED=1
        return 1
    fi
}

# Validate each module
validate_env "conquertactoe-backend" "Backend"
validate_env "conquertactoe-frontend" "Frontend"
validate_env "conquertactoe-db" "Database"
validate_env "conquertactoe-autoplayer" "Autoplayer"
validate_env "admin-dashboard" "Admin Dashboard (Root)"
validate_env "admin-dashboard/backend" "Admin Dashboard Backend"
validate_env "admin-dashboard/frontend" "Admin Dashboard Frontend"

echo ""
echo "================================================"

if [ $VALIDATION_FAILED -eq 1 ]; then
    echo -e "${RED}❌ Environment validation FAILED${NC}"
    echo ""
    echo "Please ensure all .env files exist and contain all required variables."
    echo "You can use the corresponding .env.example files as templates."
    exit 1
else
    echo -e "${GREEN}✅ Environment validation PASSED${NC}"
    echo ""
    exit 0
fi
