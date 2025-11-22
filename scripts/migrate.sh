#!/bin/bash

echo "Running database migrations..."

# User Service
echo "Migrating User Service..."
docker exec -i ecommerce-postgres psql -U ecommerce_user -d ecommerce_db < services/user-service/migrations/001_create_users_tables.sql

echo "Migrating Product Service..."
docker exec -i ecommerce-postgres psql -U ecommerce_user -d ecommerce_db < services/product-service/migrations/001_create_products_tables.sql

echo "Migrating Order Service..."
docker exec -i ecommerce-postgres psql -U ecommerce_user -d ecommerce_db < services/order-service/migrations/001_create_orders_tables.sql

echo "Migrating Payment Service..."
docker exec -i ecommerce-postgres psql -U ecommerce_user -d ecommerce_db < services/payment-service/migrations/001_create_payments_tables.sql

echo "✅ Migrations completed!"