#!/bin/bash
set -e

# Install dependencies for both workspaces (npm-based, no monorepo manager)
if [ -f server/package.json ]; then
  (cd server && npm install --no-audit --no-fund --prefer-offline)
fi

if [ -f client/package.json ]; then
  (cd client && npm install --no-audit --no-fund --prefer-offline)
fi

echo "post-merge: dependencies installed"
