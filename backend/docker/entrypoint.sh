#!/bin/sh
set -e

PORT="${PORT:-8080}"

mkdir -p \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    bootstrap/cache

chown -R www-data:www-data storage bootstrap/cache

# Render routes traffic to $PORT; the Apache image listens on 80 by default.
sed -i "s/^Listen 80$/Listen ${PORT}/" /etc/apache2/ports.conf
sed -i "s/:80>/:${PORT}>/" /etc/apache2/sites-available/000-default.conf

# Rebuild the package manifest and cache config with the runtime env vars.
php artisan package:discover --ansi || true
php artisan config:cache
php artisan route:cache || true

exec "$@"