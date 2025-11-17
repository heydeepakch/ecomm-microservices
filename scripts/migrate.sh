#!/bin/bash

echo "Running database migrations..."

# User Service
echo "Migrating User Service..."
docker exec -i ecommerce-postgres psql -U ecommerce_user -d ecommerce_db < services/user-service/migrations/001_create_users_tables.sql

echo "✅ Migrations completed!"