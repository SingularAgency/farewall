#!/bin/bash

# Deploy Supabase Functions Script
# Usage: ./scripts/deploy-functions.sh [environment]
# Environment options: develop, staging, main

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if environment is provided
if [ $# -eq 0 ]; then
    print_error "Please provide an environment: develop, staging, or main"
    echo "Usage: $0 [environment]"
    exit 1
fi

ENVIRONMENT=$1

# Validate environment
case $ENVIRONMENT in
    "develop")
        SUPABASE_PROJECT_ID="rxpvyojjxqvtwkwdghtf"
        ;;
    "staging")
        SUPABASE_PROJECT_ID="jykymoqntvrmaqqfqwps"
        ;;
    "main")
        SUPABASE_PROJECT_ID="wmmqzbpkgbiweenvrhid"
        ;;
    *)
        print_error "Invalid environment: $ENVIRONMENT"
        print_error "Valid options: develop, staging, main"
        exit 1
        ;;
esac

print_status "Deploying to $ENVIRONMENT environment (Project ID: $SUPABASE_PROJECT_ID)"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    print_error "Supabase CLI is not installed"
    print_status "Install it with: npm install -g supabase"
    exit 1
fi

# Check if we're logged in
if ! supabase projects list &> /dev/null; then
    print_error "Not logged in to Supabase"
    print_status "Please run: supabase login"
    exit 1
fi

# Link to the project
print_status "Linking to Supabase project..."
supabase link --project-ref $SUPABASE_PROJECT_ID

# Get list of functions to deploy
print_status "Discovering functions..."
FUNCTIONS=$(find supabase/functions -maxdepth 1 -type d -not -path "supabase/functions" -not -path "supabase/functions/_shared" | sed 's|supabase/functions/||')

if [ -z "$FUNCTIONS" ]; then
    print_warning "No functions found to deploy"
    exit 0
fi

print_status "Found functions: $FUNCTIONS"

# Deploy each function
for func in $FUNCTIONS; do
    print_status "Deploying function: $func"
    if supabase functions deploy $func --project-ref $SUPABASE_PROJECT_ID; then
        print_success "Successfully deployed $func"
    else
        print_error "Failed to deploy $func"
        exit 1
    fi
done

print_success "All functions deployed successfully to $ENVIRONMENT environment!"
print_status "Project ID: $SUPABASE_PROJECT_ID"
print_status "Functions deployed: $FUNCTIONS"
