#!/bin/bash

# Build and Deploy Script for Merriott Social Venue
echo "🔨 Building Merriott Social Venue website..."

# Install dependencies
npm install

# Build the site
npm run build:web

echo "✅ Build completed!"
echo "📁 Built files are in ./docs directory"
echo ""
echo "🚀 AUTOMATION NOTE:"
echo "   Changes pushed to the 'master' branch will be automatically"
echo "   built and deployed by GitHub Actions."
echo ""
echo "🔗 GitHub Pages URL: https://sherwopj.github.io/merriott-social-venue/"
echo "   (Note: This may take a few minutes to become available after push)"
