# Preplate — Architecture

**Version:** 2.0
**Status:** MVP / POC
**Scope:** Covers tech decisions, stack rationale, module map, deployment, and scalability path.
**See also:** hld.md (business flows), lld.md (implementation spec)

---

## 1. Executive Summary

Preplate is a scheduled batch food delivery platform. Restaurants define fixed delivery points
(hostels, college gates, corporate parks, PG accommodations) and time slots (Lunch, Dinner).
Customers order before a per-slot cutoff time. Staff batch-delivers to each location in a single
trip. A 4-digit PIN confirms each handoff.

This is not a general delivery platform. MVP has no rider assignment, no live GPS, and no
customer address entry.

---

## 2. Product Goals

### Business
- Enable batch delivery: fewer trips, lower cost per order
- Predictable restaurant operations via slot-based ordering with hard cutoffs
- Fast MVP launch for market validation

### Technical
- Single-server deployment with minimal ops overhead
- Modular codebase that survives team growth without rewrites
- Realtime order tracking via WebSocket
- Foundation for Phase 2+ scaling

---

## 3. Architecture Decisions (ADRs)

### ADR-01 — Modular Monolith, Not Microservices
Single deployable Django application. Domain separation via independent Django apps. No
inter-service HTTP, no service mesh, no Kubernetes. Microservice extraction deferred to Phase 3
when a specific module needs independent scaling. Microservice overhead is not justified at MVP
velocity.

### ADR-02 — Redis as Unified Infrastructure Layer
Redis handles: HTTP caching, OTP storage, rate limiting, WebSocket channel layer, and Celery
task brokering. One Redis instance eliminates the need for a separate RabbitMQ broker.
RabbitMQ is reconsidered only if advanced exchange/binding routing patterns are genuinely
required (Phase 3+).

### ADR-03 — Cart Before Order
All customer order creation flows through Cart → Checkout. There is no direct `POST /orders`
endpoint for customers. This decouples browsing from ordering and makes promo codes, group
ordering, and saved carts implementable in future phases without a model rewrite.

### ADR-04 — Daphne + Nginx (ASGI, Not WSGI)
Django Channels requires ASGI. Daphne is the Channels-native ASGI server. Nginx fronts Daphne
for TLS termination, static file serving, and connection management. Standard Gunicorn/WSGI
cannot handle WebSocket upgrades.

### ADR-05 — Explicit Business Rules in Service Layer
Business rules (cutoff enforcement, capacity checks, state machine transitions, PIN attempt
limits) live in explicit service classes under `services/`. Not in model `save()` hooks, not in
signals, not buried in serializers. This makes rules testable in isolation and auditable.

### ADR-06 — Delivery Date is Explicit
Slots (Lunch/Dinner) are recurring daily configurations. Orders must carry an explicit
`delivery_date` DateField. Using `created_at` as a proxy for delivery date causes incorrect
reporting, incorrect capacity checks, and incorrect cutoff enforcement.

---

## 4. Tech Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Language | Python | 3.12 | |
| Web Framework | Django | 5.x | |
| REST API | Django REST Framework | 3.15.x | |
| WebSocket | Django Channels | 4.x | ASGI-native |
| Task Queue | Celery | 5.3.x | |
| Task Scheduler | Celery Beat | 5.3.x | Periodic tasks |
| ASGI Server | Daphne | 4.1.x | Required for Channels |
| Reverse Proxy | Nginx | 1.24+ | TLS + static files |
| Primary Database | PostgreSQL | 16 | ACID, strong consistency |
| Cache / Broker / Channel Layer | Redis | 7 | Unified; replaces RabbitMQ |
| Auth | djangorestframework-simplejwt | 5.3.x | OTP + JWT |
| Frontend | Next.js | 14 | App Router |
| UI | TailwindCSS | 3.x | |
| Data Fetching | TanStack Query + Axios | latest | |
| Process Manager | Supervisor | 4.x | Manages Daphne + Celery |
| Infrastructure | AWS EC2 | Ubuntu 24 | Single instance for MVP |

---

## 5. System Architecture

```
[ Customer / Restaurant Admin / Platform Admin ]
                        │
                        ▼
               [ Next.js Frontend ]
           HTTP/REST ──────────── WebSocket
                        │
                        ▼
                    [ Nginx ]
          ┌─────────────┴──────────────┐
     HTTP Proxy                 WebSocket Proxy
          │                            │
          ▼                            ▼
    [ Daphne ASGI ] ←── Django ──→ [ Channels Layer ]
          │                                 │
     [ DRF APIs ]                       [ Redis ]
          │                                 │
          ▼                                 ▼
    [ PostgreSQL ]       [ Celery Workers ← Redis Queue ]
                                            │
                                    [ SMS / FCM / External ]
```

---

## 6. Backend Module Map

```
backend/
└── apps/
    ├── accounts/           OTP auth, JWT, users, RBAC
    ├── restaurants/        Restaurant CRUD, approval workflow
    ├── menus/              Categories, items, availability
    ├── delivery_locations/ Delivery point management, capacity config
    ├── slots/              Slot config, cutoff times
    ├── cart/               Cart lifecycle, item management, checkout
    ├── orders/             Orders, state machine, delivery PIN
    ├── payments/           UPI, COD, payment tracking
    ├── notifications/      Push, in-app, WebSocket events
    └── analytics/          Dashboard metrics (read-only, minimal)
```

Cross-cutting:
```
backend/
└── core/
    ├── permissions/        RBAC permission classes
    ├── exceptions/         Custom exception classes + handler
    ├── pagination/         Standard cursor/offset pagination
    └── utils/              Shared helpers (timezone, formatting)
```

---

## 7. Frontend Module Map

```
src/
├── app/
│   ├── (customer)/         Customer portal (browse, cart, orders, tracking)
│   ├── (restaurant)/       Restaurant admin portal (menu, orders, slots)
│   └── (admin)/            Platform admin portal (approvals, analytics)
├── components/             Shared UI components
├── features/               Domain modules (cart/, orders/, auth/, ...)
├── services/               Axios API clients per domain
├── hooks/                  TanStack Query data hooks
├── types/                  TypeScript interfaces
└── utils/                  Helpers, constants
```

---

## 8. User Roles

| Role | Core Capabilities |
|---|---|
| `CUSTOMER` | Browse restaurants, manage cart, checkout, track orders, collect with PIN |
| `RESTAURANT_ADMIN` | Manage restaurant/menu/slots/locations, process and update orders, verify PIN |
| `PLATFORM_ADMIN` | Approve restaurants, view all orders, platform analytics |

---

## 9. Authentication Architecture

- **Method:** Passwordless OTP via SMS. No passwords stored.
- **Tokens:** JWT access token (15 min TTL) + refresh token (7 day TTL)
- **Refresh token storage:** Redis with matching TTL
- **Access token:** Stateless JWT; validated on every request
- **Logout:** Access token JTI added to Redis blocklist (TTL = remaining token lifetime); refresh token deleted from Redis
- **OTP rate limits:** Max 3 OTP send requests per phone per 10 minutes; max 5 failed verifications per phone per hour
- **OTP TTL:** 5 minutes
- **Library:** `djangorestframework-simplejwt` with custom OTP flow

---

## 10. Order Lifecycle Overview

```
PLACED → CONFIRMED → PREPARING → OUT_FOR_DELIVERY → REACHED → DELIVERED
                                                               (terminal)
PLACED / CONFIRMED / PREPARING → CANCELLED
                                 (terminal)
```

Full state machine with valid transitions, actor permissions, and invalid transition errors is
defined in lld.md.

---

## 11. Delivery PIN Overview

Every order receives a unique 4-digit PIN at creation. PIN is immutable. Maximum 3 verification
attempts are tracked on the order. Prevents wrong-person handoffs without QR scanning complexity.

---

## 12. Realtime Architecture

- **Protocol:** WebSocket via Django Channels
- **Channel Layer:** Redis
- **Consumer:** `OrderConsumer`, group name `user_{user_id}`
- **Events fired on status change:** ORDER_CONFIRMED, ORDER_PREPARING, ORDER_OUT_FOR_DELIVERY,
  ORDER_REACHED, ORDER_DELIVERED, ORDER_CANCELLED
- **Fallback:** Frontend polls `GET /orders/{id}` every 10 seconds if WebSocket disconnects

---

## 13. Background Processing

Celery workers consume from Redis-backed task queues.

| Task Type | Examples |
|---|---|
| OTP delivery | `send_otp_task` |
| Order notifications | `order_confirmation_notification_task`, `order_status_notification_task` |
| Push notifications | `send_push_notification_task` |
| Scheduled cleanup | `cleanup_abandoned_carts_task`, `cleanup_expired_otp_task` |

Celery Beat manages the scheduled tasks. Supervisor manages the Celery worker and beat processes.

---

## 14. Security Architecture

| Concern | Control |
|---|---|
| Authentication | OTP → JWT; no passwords |
| Authorization | RBAC enforced on every API endpoint |
| Transport | HTTPS / TLS via Nginx |
| OTP abuse | 3 sends/phone/10 min; 5 failures/phone/hour (Redis counters) |
| PIN brute force | Max 3 attempts; `pin_attempts` tracked on Order model; locked after 3 |
| JWT revocation | Logout blacklists token JTI in Redis |
| Input validation | DRF serializer validation on all endpoints |
| Audit logging | Order status changes, restaurant approvals, payment events, PIN failures |

---

## 15. Deployment Architecture

```
EC2 Instance — t3.medium minimum (2 vCPU, 4 GB RAM)
├── Nginx  (port 80 / 443)
│   ├── proxy_pass → Daphne :8000  (HTTP + WebSocket upgrade)
│   └── location /static/ → serve directly from filesystem
├── Daphne  (port 8000, 4 worker processes)
├── Celery Worker  (2 concurrent workers, -c 2)
└── Celery Beat  (1 process)

Managed or self-hosted alongside EC2 for MVP:
├── PostgreSQL 16
└── Redis 7

Process management: Supervisor controls Daphne, Celery Worker, Celery Beat.
Static files: collected to /var/www/preplate/static/ via collectstatic.
Media files: stored locally for MVP; move to S3 in Phase 2.
```

---

## 16. Scalability Path

| Phase | Change |
|---|---|
| MVP | Single EC2, self-hosted PostgreSQL + Redis |
| Phase 2 | RDS PostgreSQL (+ read replica), ElastiCache Redis, ALB, dedicated Celery EC2 |
| Phase 3 | Extract Orders, Notifications, Payments as independent services; evaluate RabbitMQ |
| Phase 4 | CDN for media, analytics pipeline, ML demand forecasting service |

---

## 17. Failure Handling

| Component | Failure Mode | Response |
|---|---|---|
| WebSocket | Connection drops | Frontend polls REST every 10s |
| Redis | Instance down | Channels degrades; Celery tasks fail + retry with backoff; OTP fails gracefully |
| Celery Worker | Process crash | Supervisor restarts; tasks re-queued |
| Push Notification | FCM failure | In-app Notification record still created as fallback |
| Payment | Gateway timeout | Order stays PLACED; customer retries or switches to COD |
| PostgreSQL | Connection error | DRF returns 500; Sentry captures (Phase 2 monitoring) |

---

## 18. Future Roadmap

- **Phase 2:** Rider onboarding, order-to-rider assignment, delivery tracking, ratings, reviews,
  Razorpay/PayU payment gateway, S3 media storage
- **Phase 3:** Group ordering, meal subscriptions, multi-city support
- **Phase 4:** Route optimization, ML demand forecasting, institutional contracts