# Preplate — High Level Design (HLD)

**Version:** 2.0
**Status:** MVP / POC
**Scope:** Business workflows, actor responsibilities, module interactions, data flows, NFRs.
**See also:** architecture.md (tech decisions), lld.md (implementation spec)

---

## 1. Purpose

This document describes what Preplate does — its business workflows, actor responsibilities,
module interactions, and system-level data flows. It does not describe how to implement them.
See lld.md for models, API contracts, and service designs.

---

## 2. Product Overview

Preplate is a scheduled batch food delivery platform. Restaurants define:
- Fixed delivery points (hostels, college gates, corporate parks, PG accommodations)
- Time slots (Lunch, Dinner) with hard cutoff times and daily delivery windows
- Menus with item availability

Customers place orders before the slot cutoff for a specific location and date. Restaurant staff
batch-delivers to each location in a single trip. A 4-digit PIN confirms every handoff.

**What Preplate is not (MVP):** No door-to-door delivery, no customer address input, no rider
assignment, no live GPS tracking.

---

## 3. Actors

### Customer
- Browse approved restaurants
- Add items to cart for a specific delivery location, slot, and date
- Checkout and pay (UPI or COD)
- Track order status in realtime via WebSocket
- Collect meal at the delivery location using their delivery PIN

### Restaurant Admin
- Configure delivery locations (with per-slot capacity limits)
- Configure slots (name, cutoff time, delivery window)
- Build and manage menu (categories + items, availability toggle)
- View incoming orders and accept them
- Update order status through the lifecycle
- Verify customer PIN to confirm delivery

### Platform Admin
- Approve or reject restaurant registrations
- Monitor orders across all restaurants
- View platform-wide analytics

---

## 4. System Context

```
[ Customer ] ─────────────────────────────────────┐
                                                   │
[ Restaurant Admin ] ──── [ Next.js Web App ] ─── [ Django Backend ]
                                                        │
[ Platform Admin ] ────────────────────  ┌─────────────┼────────────────┐
                                         ▼             ▼                ▼
                                   [ PostgreSQL ]   [ Redis ]   [ Celery Workers ]
                                                       │
                                              [ Channel Layer ]
                                                       │
                                               [ WebSocket Events ]
                                                → Customer Browser
```

---

## 5. Component Architecture

```
Frontend
├── Customer Portal        Browse → Cart → Checkout → Track
├── Restaurant Portal      Menu mgmt → Order processing → PIN verify
└── Admin Portal           Restaurant approval → Analytics

Backend Modules
├── Authentication         OTP + JWT (issue, refresh, revoke)
├── Restaurants            CRUD + approval workflow
├── Menus                  Categories + Items + availability
├── Delivery Locations     Per-restaurant points + capacity
├── Slots                  Per-restaurant time slots + cutoff
├── Cart                   Cart lifecycle + items + checkout
├── Orders                 State machine + order history + PIN
├── Payments               UPI + COD + status tracking
├── Notifications          Push + In-App + WebSocket events
└── Analytics              Dashboard metrics (read-only)
```

---

## 6. Customer Journey

```
Customer Login (OTP → JWT)
           ↓
Browse Approved Restaurants
           ↓
Select Restaurant
           ↓
Select Delivery Location + Slot + Date
           ↓
Cart Initialized ◄── Cutoff enforced here
           │         (today + past cutoff → rejected immediately)
           ↓
Browse Menu
           ↓
Add Items to Cart ◄── Price snapshotted at add time
           ↓
Review Cart (update quantities, remove items)
           ↓
Checkout ◄── Cutoff re-validated + Capacity checked (SELECT FOR UPDATE)
           ↓
Pay (UPI or COD)
           ↓
Order Created → PIN generated and shown to customer
           ↓
Track Order in Realtime (WebSocket)
           ↓
Collect Meal at Location using PIN
```

---

## 7. Restaurant Management Flow

```
Platform Admin approves restaurant
              ↓
Restaurant Admin logs in (OTP)
              ↓
Create Delivery Locations
(name, address, capacity_per_slot)
              ↓
Create Slots
(name, cutoff_time, delivery_start_time, delivery_end_time)
              ↓
Build Menu
(categories → items → toggle availability)
              ↓
──── DAILY OPERATIONS ────────────────────────────────
View incoming orders (PLACED)
              ↓
Confirm orders (PLACED → CONFIRMED)
              ↓
Prepare meals (CONFIRMED → PREPARING)
              ↓
Dispatch batch (PREPARING → OUT_FOR_DELIVERY)
              ↓
Arrive at location (OUT_FOR_DELIVERY → REACHED)
              ↓
Verify PIN per customer (REACHED → DELIVERED)
```

---

## 8. Slot Cutoff Enforcement

Slot `cutoff_time` is a daily recurring TIME (not a datetime). It applies every day.

```
Customer selects slot + delivery_date
              ↓
Is delivery_date == today?
    │
    ├── YES → Is current_time (IST) < slot.cutoff_time?
    │               │
    │               ├── YES → Allow cart initialization
    │               └── NO  → Reject: 400 CUTOFF_PASSED
    │                         "Ordering is closed for Lunch today"
    │
    └── NO (future date) → Allow cart initialization
```

**Re-validation at checkout:** Cutoff is checked again at `POST /cart/checkout/` to handle
the case where a customer's browser session was open past the cutoff time.

---

## 9. Delivery Location Capacity Enforcement

Each `DeliveryLocation` has a `capacity_per_slot` integer — the maximum active orders
allowed for that location in a single slot on a single day.

```
At POST /cart/checkout/:
              ↓
Begin DB transaction
              ↓
SELECT FOR UPDATE on orders WHERE:
    delivery_location = cart.delivery_location
    AND slot = cart.slot
    AND delivery_date = cart.delivery_date
    AND status NOT IN ('CANCELLED')
              ↓
confirmed_count >= capacity_per_slot?
    ├── YES → Rollback, raise 400 CAPACITY_EXCEEDED
    └── NO  → Proceed with order creation, commit
```

`SELECT FOR UPDATE` prevents two concurrent checkouts from both passing the capacity check
and both creating orders that exceed the limit.

---

## 10. Cart Workflow

### Cart Rules
1. **Single Restaurant** — all items in a cart belong to one restaurant
2. **Single Slot** — all items target the same delivery slot
3. **Single Delivery Location** — cart delivers to one location
4. **Single Active Cart** — one ACTIVE cart per customer; initializing a new cart
   automatically abandons the previous one

### Cart Statuses
```
ACTIVE       Customer is building their order
CHECKED_OUT  Cart was converted to an order via checkout
ABANDONED    Replaced by new cart, cleared by customer,
             or expired (>24 h without checkout)
```

### Abandoned Cart Cleanup
A Celery Beat task runs every hour and marks carts `ABANDONED` if `status = ACTIVE`
and `updated_at < now() - 24h`.

---

## 11. Checkout and Order Creation Sequence

All customer orders are created through `POST /api/v1/cart/checkout/`. There is no direct
`POST /orders/` endpoint for customers.

```
POST /cart/checkout/ { "payment_method": "UPI" }
              ↓
[CartValidationService]
    Validate cart is ACTIVE
    Validate cart has >= 1 item
    Re-validate slot cutoff
    Re-validate all items still available
              ↓
[CartValidationService.validate_capacity()]  ← SELECT FOR UPDATE
              ↓
BEGIN DB TRANSACTION
    Create Order (restaurant, slot, location, delivery_date, status=PLACED)
    Generate order_number (ORD-YYYYMMDD-XXXXXX via Redis INCR)
    Generate delivery_pin (4-digit random)
    Create OrderItems (copy quantity + unit_price from CartItems)
    Calculate subtotal, total
    Create Payment record (status=PENDING)
    Mark Cart → CHECKED_OUT
COMMIT
              ↓
Enqueue: order_confirmation_notification_task (async, post-commit)
              ↓
Return: order_id, order_number, delivery_pin, total
```

---

## 12. Order Lifecycle

### State Machine

```
                    ┌─────────────┐
                    │   PLACED    │────────────────────┐
                    └──────┬──────┘                    │
                           ↓                           │
                    ┌─────────────┐                    │
                    │  CONFIRMED  │───────────────────►│
                    └──────┬──────┘                    │
                           ↓                      CANCELLED
                    ┌─────────────┐              (terminal)
                    │  PREPARING  │───────────────────►│
                    └──────┬──────┘
                           ↓
                  ┌─────────────────────┐
                  │  OUT_FOR_DELIVERY   │
                  └──────────┬──────────┘
                             ↓
                    ┌─────────────┐
                    │   REACHED   │
                    └──────┬──────┘
                           ↓
                    ┌─────────────┐
                    │  DELIVERED  │
                    └─────────────┘
                       (terminal)
```

### Transition Actor Permissions

| Transition | Actor |
|---|---|
| PLACED → CONFIRMED | Restaurant Admin |
| CONFIRMED → PREPARING | Restaurant Admin |
| PREPARING → OUT_FOR_DELIVERY | Restaurant Admin |
| OUT_FOR_DELIVERY → REACHED | Restaurant Admin |
| REACHED → DELIVERED | Restaurant Admin (only after successful PIN verify) |
| PLACED / CONFIRMED / PREPARING → CANCELLED | Restaurant Admin |

DELIVERED and CANCELLED are terminal. No transitions out of them.

---

## 13. Delivery PIN Workflow

```
Order created
      ↓
4-digit PIN generated and stored on Order
      ↓
PIN shown to Customer on confirmation screen
      ↓
─── At Delivery Location ──────────────────────────────
Restaurant Admin marks order REACHED
      ↓
Customer presents PIN to staff
      ↓
Staff submits: POST /orders/{id}/verify-pin/ { "pin": "4827" }
      ↓
Server checks pin_attempts >= 3?
    ├── YES → 403 PIN_LOCKED "Max attempts reached. Contact support."
    └── NO  → PIN correct?
                  ├── YES → Transition REACHED → DELIVERED
                  │         Return: { verified: true }
                  └── NO  → Increment pin_attempts
                             Return: 400 PIN_INVALID
                             (order stays REACHED, staff can retry up to 3 total)
```

**PIN security notes:**
- PIN is plain 4-digit integer stored as VARCHAR(4). Low-risk delivery token.
- Max 3 attempts tracked via `pin_attempts` field on the Order model.
- After 3 failures the order is locked; restaurant admin contacts platform support.

---

## 14. Payment Flow

### UPI
```
Checkout → Payment record (PENDING, method=UPI) created
         → UPI payment link / QR presented (MVP: manual confirmation)
         → On payment callback: Payment.status = SUCCESS
         → Order progresses through normal lifecycle
```

Note: Phase 2 integrates Razorpay or PayU with webhook callbacks to automate this.

### Cash on Delivery (COD)
```
Checkout → Payment record (PENDING, method=COD) created
         → Order progresses through normal lifecycle
         → Cash collected at delivery
         → Payment.status = SUCCESS set on DELIVERED (or manually by restaurant admin)
```

---

## 15. Realtime Order Tracking

```
Restaurant Admin updates status via PATCH /orders/{id}/status/
              ↓
OrderStateMachine validates and saves transition
              ↓
Django post_save signal fires on Order
              ↓
OrderNotificationService.publish_status_event(order)
              ↓
channel_layer.group_send("user_{customer_id}", event_payload)
              ↓
OrderConsumer (WebSocket) sends to customer browser
              ↓
Frontend receives event → updates order tracking UI
```

WebSocket event payload:
```json
{
  "type": "order_status_update",
  "order_id": "uuid",
  "order_number": "ORD-20240612-000042",
  "status": "PREPARING"
}
```

Fallback: If WebSocket is disconnected, frontend polls `GET /orders/{id}` every 10 seconds.

---

## 16. Notification Flow

```
Order status changes (or order created)
              ↓
Celery task enqueued: order_status_notification_task
              ↓
Notification record created in DB (user, title, message, type, is_read=False)
              ↓
send_push_notification_task → FCM push to customer device
              ↓
Fallback: if FCM fails, in-app notification still available via GET /notifications/
```

---

## 17. Analytics Overview

### Restaurant Dashboard
- Today's total orders (by slot: Lunch / Dinner)
- Today's revenue
- Orders by status (PLACED, CONFIRMED, PREPARING, OUT_FOR_DELIVERY, REACHED, DELIVERED)
- Pending orders requiring action

### Platform Dashboard (Platform Admin only)
- Total approved restaurants
- Total orders today
- Orders by status breakdown
- Today's total revenue across all restaurants

---

## 18. Data Entity Overview

```
User ─────────────────────────► Order ────► OrderItem ────► MenuItem
                                   │                             │
Restaurant ──────────────────► Restaurant                       │
     │                             │                        MenuCategory
     ├── DeliveryLocation ─────────┤                             │
     │                             │                        Restaurant
     ├── DeliverySlot ─────────────┤
     │                             │
     └── MenuCategory              ▼
          └── MenuItem           Payment
                                   │
Cart ────► CartItem ──► MenuItem    │
  │                                │
  ├── Restaurant                 Notification ──► User
  ├── DeliverySlot
  └── DeliveryLocation
```

Key relationships:
- A Customer has at most one ACTIVE Cart at a time
- A Cart converts to exactly one Order via checkout
- Order and CartItem both snapshot `unit_price` — not live from MenuItem.price
- Restaurant owns its Locations, Slots, Categories, and Items
- All FK deletes on Order use PROTECT (historical records must not be cascade-deleted)

---

## 19. Non-Functional Requirements

| Requirement | Target |
|---|---|
| API p95 latency | < 300 ms |
| Order confirmation (checkout → response) | < 2 s |
| WebSocket event delivery (status change → browser) | < 500 ms |
| Platform availability | 99%+ |
| Concurrent users (MVP target) | 1,000 |
| Concurrent users (future target) | 10,000+ |
| OTP delivery time | < 30 s |

---

## 20. Security Summary

| Concern | Control |
|---|---|
| Authentication | OTP (passwordless) → JWT access + refresh |
| Token lifetimes | Access: 15 min; Refresh: 7 days |
| Session revocation | Logout blacklists access token JTI in Redis |
| Authorization | RBAC enforced on every endpoint; object-level ownership checks |
| Transport | HTTPS / TLS via Nginx |
| OTP abuse | 3 send requests / phone / 10 min; 5 failures / phone / 1 hour |
| PIN brute force | Max 3 attempts; `pin_attempts` field on Order; locked on 3rd failure |
| Input validation | DRF serializer validation on all endpoints |
| Audit logging | Order status changes, approvals, payment events, PIN failures |