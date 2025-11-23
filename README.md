# 🚀 E-Commerce Microservices Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white)](https://kubernetes.io/)

> **A cloud-native e-commerce backend built with microservices, focusing on real-world backend engineering, distributed systems, and DevOps practices.**

[📖 Documentation](docs/INDEX.md) • [🚀 Quick Start](#-quick-start) • [💼 For Recruiters](#-for-recruiters)

---

## 📊 Project Overview

This project is a **production-style e-commerce backend** composed of **5 independently deployable microservices**:

- **User Service** – authentication, authorization, profiles  
- **Product Service** – catalog, categories, images, caching  
- **Order Service** – order lifecycle, Saga orchestration, background jobs  
- **Payment Service** – Stripe-based payment flow & webhooks  
- **API Gateway** – single entry point with auth, rate limiting, and caching  

It is designed as a **portfolio project** to demonstrate:

- Microservices architecture & service boundaries  
- Distributed transaction handling (Saga pattern)  
- Stripe integration & webhook handling  
- Redis-backed caching, queues, and rate limiting  
- Docker + Kubernetes deployment (currently on Docker Desktop)  
- Observability with Prometheus & Grafana  

> **Note:** All core microservices are implemented and working together.  
> Automated tests, CI/CD, and cloud (GCP) deployment are **in progress**.

---

## 🏗️ Architecture

### High-Level Design

```
                   ┌─────────────┐
                   │   Clients   │
                   │ Web/Mobile  │
                   └──────┬──────┘
                          │
                   ┌──────▼──────┐
                   │ API Gateway │  (8080)
                   │ - JWT Auth  │
                   │ - Caching   │
                   │ - Rate Limit│
                   └──────┬──────┘
                          │
     ┌────────────────────┼────────────────────┐
     │                    │                    │
 ┌───▼─────┐         ┌────▼──────┐        ┌────▼──────┐
 │  User   │         │  Product  │        │   Order   │
 │ Service │         │ Service   │        │ Service   │
 │ (3001)  │         │ (3002)    │        │ (3003)    │
 │ - Auth  │         │ - Catalog │        │ - Saga    │
 │ - RBAC  │         │ - Images  │        │ - BullMQ  │
 └────┬────┘         └────┬──────┘        └────┬──────┘
      │                   │                  │
      │                   │                  │
      │              ┌────▼──────┐
      │              │  Payment  │
      └─────────────▶│  Service  │◀─────────────┐
                     │  (3004)   │              │
                     │ - Stripe  │              │
                     │ - Webhook │              │
                     └───────────┘              │
┌─────────────────────────────────────────────────────────────┐
│                     Data & Infra Layer                      │
│  PostgreSQL  •  Redis  •  MinIO  •  Prometheus  •  Grafana │
└─────────────────────────────────────────────────────────────┘
```

### Microservices Overview

| Service | Port | Responsibility | Tech Stack |
|---------|------|----------------|------------|
| **API Gateway** | 8080 | Routing, JWT verification, rate limiting, caching | Node.js, TypeScript, Express, Redis |
| **User Service** | 3001 | Auth, JWT access/refresh tokens, RBAC, profiles | Node.js, TypeScript, Express, PG, JWT |
| **Product Service** | 3002 | Products, categories, full-text search, MinIO image upload, caching | Node.js, TypeScript, Express, PG, Redis, MinIO |
| **Order Service** | 3003 | Order lifecycle, Saga orchestration, BullMQ workers | Node.js, TypeScript, Express, PG, BullMQ |
| **Payment Service** | 3004 | Stripe payment intents, webhooks, refunds | Node.js, TypeScript, Express, Stripe, PG |

---

## 💻 Tech Stack

### Backend
- **Runtime:** Node.js (TypeScript)
- **Framework:** Express.js
- **API Style:** REST
- **Auth:** JWT (access + refresh tokens)
- **Validation:** Custom validators inside services

### Data & Storage
- **Database:** PostgreSQL
- **Cache & Queues:** Redis (cache-aside pattern, rate limiting, BullMQ queues)
- **Object Storage:** MinIO (S3-compatible) for product images

### Infrastructure & Operations
- **Containerization:** Docker, Docker Compose
- **Orchestration:** Kubernetes (manifests under `infrastructure/k8s/`)
  - Currently used with Docker Desktop Kubernetes
  - Manifests structured to be portable to managed clusters (e.g. GKE)
- **Monitoring & Metrics:** Prometheus, Grafana, exporters (Postgres, Redis, Node)
- **Logging:** Structured JSON logging (Pino)

### External Integrations
- **Payment Gateway:** Stripe (test mode)
- **Background Jobs:** BullMQ (Redis-backed)

---

## 📂 Project Structure

```
ecommerce-microservices/
├── services/
│   ├── api-gateway/          # Entry point: auth, routing, rate limiting, caching
│   ├── user-service/         # Users, auth, JWT, RBAC
│   ├── product-service/      # Product catalog, categories, images, caching
│   ├── order-service/        # Orders, Saga, BullMQ workers
│   └── payment-service/      # Stripe integration, webhooks, refunds
├── infrastructure/
│   ├── docker-compose.yml
│   ├── docker-compose.monitoring.yml
│   ├── prometheus.yml
│   ├── alertmanager.yml
│   ├── alert-rules.yml
│   └── k8s/
│       ├── namespace.yaml
│       ├── configmaps/
│       ├── secrets/
│       ├── databases/
│       └── services/
├── scripts/
│   └── migrate.sh            # Convenience script to run DB migrations
├── postman/
│   ├── collections/          # Postman API collections
│   └── environments/         # Postman environment variables
└── docs/
    ├── INDEX.md
    ├── PHASE-2-PRODUCT-SERVICE*.md
    ├── PHASE-3-ORDER-SERVICE.md
    ├── PHASE-4-PAYMENT-SERVICE*.md
    ├── PHASE-5-API-GATEWAY*.md
    └── ...other detailed docs
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Basic docker / kubectl knowledge (for Kubernetes section)

### 1️⃣ Run Locally with Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/ecommerce-microservices.git
cd ecommerce-microservices

# Copy and configure environment variables
cp infrastructure/.env.example infrastructure/.env

# Edit infrastructure/.env to set:
# - JWT secrets
# - Stripe keys (test)
# - Postgres / Redis config, etc.

# Start core stack (Postgres, Redis, MinIO, microservices)
cd infrastructure
docker-compose up -d

# Run database migrations for all services
cd ..
./scripts/migrate.sh

# Verify API Gateway is healthy
curl http://localhost:8080/health
```

**Access Points:**
- **API Gateway:** http://localhost:8080
- **Individual services** (for debugging):
  - User: http://localhost:3001
  - Product: http://localhost:3002
  - Order: http://localhost:3003
  - Payment: http://localhost:3004

### 2️⃣ Run Monitoring Stack (Optional)

```bash
cd infrastructure
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

- **Prometheus:** http://localhost:9090
- **Grafana:** http://localhost:3000 (default: admin / admin123)
- **Alertmanager:** http://localhost:9093

### 3️⃣ Local Kubernetes (Docker Desktop)

**Status:** Kubernetes manifests are created and tested on Docker Desktop.  
Cloud deployment (e.g. GKE) and full CI/CD are planned next steps.

```bash
# Enable Kubernetes in Docker Desktop first

# Build images locally
docker build -t ecommerce-user-service:latest     services/user-service
docker build -t ecommerce-product-service:latest  services/product-service
docker build -t ecommerce-order-service:latest    services/order-service
docker build -t ecommerce-payment-service:latest  services/payment-service
docker build -t ecommerce-api-gateway:latest      services/api-gateway

# Apply Kubernetes manifests
cd infrastructure/k8s
kubectl apply -f namespace.yaml
kubectl apply -f configmaps/
kubectl apply -f secrets/
kubectl apply -f databases/
kubectl apply -f services/

# Check resources
kubectl get pods -n ecommerce
kubectl get services -n ecommerce

# Port-forward API Gateway for local access
kubectl port-forward -n ecommerce svc/api-gateway 8080:8080
```

---

## 🎯 Key Features & Design Decisions

### 1. Microservices & Bounded Contexts

- **User Service:** auth, JWT issuance, refresh tokens, roles (customer/seller/admin)
- **Product Service:** product & category management, full-text search, image uploads to MinIO, Redis cache-aside
- **Order Service:** order state machine, Saga orchestration, coordination with Product & Payment services, async workers via BullMQ
- **Payment Service:** Stripe payment intents, webhook handling, status updates, refunds
- **API Gateway:** central ingress, JWT verification, rate limiting, caching, centralized error handling

### 2. Distributed Transactions (Saga Pattern)

Order creation triggers:
- Stock reservation in Product Service
- Payment intent creation in Payment Service

On failure, compensating actions revert changes:
- Release reserved stock
- Cancel order

Prevents tight coupling and avoids 2PC while keeping data consistent.

### 3. Caching & Performance

- Redis cache-aside for:
  - Product listings & details
  - Frequently accessed data
- Cache invalidation on writes/updates to ensure consistency.
- API Gateway can cache certain public responses (e.g. product lists).

### 4. Payments & Webhooks

- Stripe used in test mode with:
  - Payment intents
  - Webhook verification using signing secret
- Idempotency strategies:
  - Keys to avoid processing the same event multiple times
  - Database constraints to enforce uniqueness

### 5. API Gateway & Rate Limiting

- JWT validation before proxying to downstream services.
- Redis-backed rate limiting (e.g. token bucket / sliding window style).
- Central place to enforce:
  - AuthN/AuthZ
  - CORS
  - Logging and error normalization

### 6. Observability

- Prometheus metrics exporter integrated with services.
- Grafana dashboards for:
  - Request rate
  - Latency
  - Errors
  - DB/cache metrics
- Healthcheck endpoints (`/health`) for readiness & liveness.

---

## 🔒 Security

- Password hashing with bcrypt
- JWT access tokens + refresh tokens
- Role-based access control (RBAC)
- Input validation and parameterized queries
- Rate limiting on sensitive routes (auth, payments)
- Webhook signature verification for Stripe
- CORS configuration for allowed origins

---

## 📊 API Overview (Selected Endpoints)

### Auth (`/api/auth` via API Gateway)

```http
POST   /api/auth/register       # Register a new user
POST   /api/auth/login          # Login, returns access + refresh tokens
POST   /api/auth/refresh        # Rotate access token using refresh token
POST   /api/auth/logout         # Logout and invalidate refresh token
```

### Users (`/api/users`)

```http
GET    /api/users/profile       # Get current user profile (JWT required)
PUT    /api/users/profile       # Update profile
```

### Products (`/api/products`)

```http
GET    /api/products            # List products (public, cacheable)
GET    /api/products/:id        # Get product details
POST   /api/products            # Create product (seller only)
PUT    /api/products/:id        # Update product (seller only)
DELETE /api/products/:id       # Delete product (seller only)
POST   /api/products/:id/upload-image  # Upload product image (seller only)
```

### Orders (`/api/orders`)

```http
GET    /api/orders              # List current user's orders
GET    /api/orders/:id          # Get order details
POST   /api/orders              # Create order (starts Saga)
POST   /api/orders/:id/cancel   # Cancel order
PUT    /api/orders/:id/status   # Update status (seller/admin)
PUT    /api/orders/:id/tracking # Add tracking info (seller/admin)
GET    /api/orders/:id/history  # Get order status history
```

### Payments (`/api/payments`)

```http
POST   /api/payments/create-intent  # Create Stripe payment intent
GET    /api/payments/order/:orderId # Get payment status
POST   /api/payments/refund         # Refund (admin)
```

> **Note:** For complete API documentation, see [Postman Collections](postman/README.md) or import the collection from `postman/collections/`.

---

## 🧪 Testing & CI/CD

### Current Status:
- Basic testing setup exists per service.
- Full unit, integration, and end-to-end coverage is **planned and in progress**.
- CI/CD with GitHub Actions is **planned** (test → build → push images → deploy).

### Planned Tooling:
- **Unit & Integration Tests:** Jest, Supertest
- **E2E / Load (planned):** k6 / Testcontainers
- **CI/CD (planned):** GitHub Actions workflows for:
  - Linting & tests
  - Docker image builds
  - Applying Kubernetes manifests

---

## 🎯 Current Status & Roadmap

### ✅ Implemented
- ✅ All 5 microservices (User, Product, Order, Payment, API Gateway)
- ✅ Docker Compose setup for local development
- ✅ PostgreSQL + Redis + MinIO integration
- ✅ Stripe payment integration (test mode) with webhooks
- ✅ Redis-backed caching and BullMQ job queues
- ✅ Kubernetes manifests for services, databases, config, secrets
- ✅ Prometheus + Grafana monitoring stack
- ✅ API Gateway with auth, rate limiting, and basic caching
- ✅ Postman collections for API testing

### 🚧 In Progress
- 🚧 Proper test suite for each service (unit + integration)
- 🚧 E2E / load testing
- 🚧 GitHub Actions CI/CD pipeline
- 🚧 Cloud deployment (e.g. GKE or other managed Kubernetes)

### 🔮 Future Enhancements
- 🔮 GraphQL or gRPC for internal communication
- 🔮 Event-driven architecture (Kafka / message bus)
- 🔮 OpenTelemetry + Jaeger for distributed tracing
- 🔮 Public frontend (React / Next.js)
- 🔮 Admin dashboard & analytics
- 🔮 Recommendation / review service

---


### What This Project Demonstrates

**Architecture & Design:**
- Microservices architecture with clear service boundaries
- Distributed transaction handling (Saga pattern)
- API Gateway pattern for centralized concerns
- Event-driven workflows with background job processing

**Technical Skills:**
- TypeScript/Node.js backend development
- PostgreSQL database design with migrations
- Redis for caching, rate limiting, and queues
- Docker containerization and Kubernetes orchestration
- Stripe payment gateway integration
- Observability with Prometheus & Grafana

**DevOps & Infrastructure:**
- Docker Compose for local development
- Kubernetes manifests for production deployment
- Monitoring and alerting setup
- Health checks and graceful shutdowns

**Best Practices:**
- JWT authentication with refresh tokens
- Role-based access control (RBAC)
- Idempotency for distributed operations
- Cache invalidation strategies
- Webhook signature verification
- Error handling and logging

### How to Evaluate

1. **Review the Code:**
   - Check service implementations in `services/`
   - Review database migrations for schema design
   - Examine Docker and Kubernetes configurations

2. **Test the APIs:**
   - Import Postman collection from `postman/collections/`
   - Follow the testing workflow in `postman/README.md`
   - Test the complete order flow: Register → Login → Browse → Order → Pay

3. **Run Locally:**
   - Follow the Quick Start guide above
   - Check service logs: `docker-compose logs -f <service-name>`
   - Verify health endpoints

4. **Review Architecture:**
   - See `docs/` folder for detailed phase-by-phase implementation
   - Check Kubernetes manifests in `infrastructure/k8s/`
   - Review monitoring setup in `infrastructure/prometheus.yml`

---


## 🤝 Contributing

This is a portfolio project, but suggestions and feedback are welcome! Please open an issue or submit a pull request.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

## 👤 Author

**Deepak Choudhary**

- GitHub: [@heydeepakch](https://github.com/heydeepakch)
- LinkedIn: [LinkedIn](https://www.linkedin.com/in/deepak-choudhary18/)
- Email: hellodeepakch@gmail.com

---

## 🙏 Acknowledgments

- Built as a learning project to demonstrate microservices architecture
- Inspired by real-world e-commerce backend requirements
- Uses industry-standard tools and patterns

---

**⭐ If you find this project helpful, please give it a star!**

