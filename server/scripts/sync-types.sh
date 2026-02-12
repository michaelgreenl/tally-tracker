#!/bin/bash

# Generates Prisma client + Zod types on both server and client, then copies
# the shared type directory to the client. Run from the server project root.
# The server is the single source of truth for all shared types.

CLIENT_DIR="../tally-tracker-client"

echo "🚀 Starting Type Sync..."

echo "📦 Generating Server Prisma Client..."
npx prisma generate

echo "📄 Combining and Copying schema to Client..."
cat prisma/schema/*.prisma > "$CLIENT_DIR/schema.prisma"

# Fix generator output path for the client's directory structure
# NOTE: -i '' is required for macOS sed
sed -i '' 's|\.\./\.\./src/types|./src/types|g' "$CLIENT_DIR/schema.prisma"

echo "📦 Generating Client Prisma Client..."
(cd "$CLIENT_DIR" && npx prisma generate --schema=./schema.prisma)

echo "🔄 Syncing Shared Types..."
rm -rf "$CLIENT_DIR/src/types/shared"
cp -r src/types/shared "$CLIENT_DIR/src/types/shared"

echo "🧹 Cleaning up..."
rm -rf "../src"

echo "✅ Sync Complete!"
