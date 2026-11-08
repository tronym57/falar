#!/bin/sh
# Publishes dist/ to the gh-pages branch, which GitHub Pages serves.
set -e
cd dist
touch .nojekyll
git init -q -b gh-pages
git add -A
git -c user.name="tronym57" -c user.email="tronym57@users.noreply.github.com" commit -q -m "Deploy $(date -u +%Y-%m-%dT%H:%MZ)"
git push -q -f https://github.com/tronym57/falar.git gh-pages
rm -rf .git
echo "Deployed to https://tronym57.github.io/falar/"
