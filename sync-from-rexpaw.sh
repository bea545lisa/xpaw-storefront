#!/bin/sh
# Holt alle neuen Commits von rexpaw-storefront und mergt sie in xpaw-storefront.
# config/settings_data.json bleibt dabei automatisch unangetastet (siehe .gitattributes).
set -e
git fetch upstream
git merge upstream/main --allow-unrelated-histories -m "Sync from rexpaw-storefront"
echo "Fertig. Falls alles ok aussieht: git push"
