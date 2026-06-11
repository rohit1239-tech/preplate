# LLD Addendum (Merged Cart Version)

## 1. Revised Domain Model

### Cart Lifecycle

```text
ACTIVE
   |
   └──► CHECKED_OUT

ACTIVE
   |
   └──► ABANDONED
```

### Order Lifecycle

```text
PLACED
   ↓
CONFIRMED
   ↓
PREPARING
   ↓
OUT_FOR_DELIVERY
   ↓
REACHED
   ↓
DELIVERED
```

Cancellation:

```text
PLACED      -> CANCELLED
CONFIRMED   -> CANCELLED
PREPARING   -> CANCELLED
```

Terminal States:

```text
DELIVERED
CANCELLED
```

---

# 2. Cart Is The Only Checkout Path

Order creation MUST happen through Cart.

Remove:

```http
POST /orders
```

Customer flow:

```text
Restaurant
    ↓
Delivery Location
    ↓
Delivery Date
    ↓
Slot
    ↓
Cart
    ↓
Checkout
    ↓
Payment
    ↓
Order
```

Order APIs become read-only for customers.

```http
GET /orders

GET /orders/{id}
```

---

# 3. Cart Model

```sql
id UUID PK

customer_id FK

restaurant_id FK

delivery_location_id FK

slot_id FK

delivery_date DATE

status

created_at

updated_at
```

Status:

```python
ACTIVE
CHECKED_OUT
ABANDONED
```

Indexes:

```sql
(customer_id, status)

(restaurant_id)

(delivery_date)
```

---

# 4. Order Model (Updated)

```sql
id UUID PK

order_number

customer_id FK

restaurant_id FK

delivery_location_id FK

slot_id FK

delivery_date DATE

status

delivery_pin

subtotal

discount_amount

delivery_fee

total

payment_status

created_at

updated_at
```

Notes:

```text
subtotal =
sum(order_items)

total =
subtotal
- discount_amount
+ delivery_fee
```

For MVP:

```text
discount_amount = 0

delivery_fee = 0
```

but fields exist from day one.

---

# 5. Cart Initialization Flow

Cart cannot be created from menu item alone.

Step 1:

```http
POST /cart
```

Request:

```json
{
  "restaurant_id":"uuid",
  "delivery_location_id":"uuid",
  "slot_id":"uuid",
  "delivery_date":"2026-06-20"
}
```

Response:

```json
{
  "cart_id":"uuid"
}
```

Step 2:

```http
POST /cart/items
```

Request:

```json
{
  "cart_id":"uuid",
  "menu_item_id":"uuid",
  "quantity":2
}
```

This guarantees:

* Single restaurant
* Single slot
* Single delivery location
* Single delivery date

---

# 6. Capacity Enforcement

Capacity check occurs during checkout.

Validation:

```python
current_orders = Order.objects.select_for_update().filter(
    delivery_location=location,
    slot=slot,
    delivery_date=delivery_date
).exclude(
    status="CANCELLED"
).count()
```

Validation:

```python
if current_orders >= location.capacity_per_slot:
    raise CapacityExceededException()
```

Transaction:

```python
@transaction.atomic
```

Required.

Reason:

Prevent overselling under concurrent checkout.

---

# 7. Slot Configuration

Slots are restaurant-specific.

```sql
cutoff_time TIME

delivery_start_time TIME

delivery_end_time TIME
```

Example:

```text
Lunch

cutoff_time = 10:30 AM
```

Interpretation:

```text
Daily recurring time
```

not a datetime.

---

# 8. Checkout Validation Rules

Before checkout:

Validate:

```text
Cart Exists

Cart Active

Restaurant Active

Slot Active

Delivery Location Active

Capacity Available

Items Available

Cutoff Not Crossed
```

Cutoff Check:

```python
current_time < slot.cutoff_time
```

for selected delivery_date.

---

# 9. Price Snapshot Rules

CartItem price is immutable.

When item is added:

```python
cart_item.unit_price =
menu_item.price
```

Afterward:

```text
DO NOT UPDATE
```

even if menu price changes.

Reason:

Price consistency.

---

# 10. Restaurant Scoped APIs

Replace:

```http
GET /delivery-locations

GET /slots
```

With:

```http
GET /restaurants/{id}/delivery-locations

GET /restaurants/{id}/slots
```

Benefits:

* Smaller payloads
* Better caching
* Cleaner UX

---

# 11. Pagination Standard

All list endpoints use pagination.

Request:

```http
GET /restaurants?page=1&page_size=20
```

Response:

```json
{
  "count":100,
  "next":"...",
  "previous":"...",
  "results":[]
}
```

Applies to:

```text
Restaurants

Orders

Notifications

Menu Items
```

---

# 12. OTP Security

Rate Limits:

Per Phone:

```text
3 OTP requests / 5 minutes
```

Per IP:

```text
10 OTP requests / hour
```

Lockout:

```text
30 minute cooldown
```

Storage:

```text
Redis
```

OTP Expiry:

```text
5 minutes
```

---

# 13. Delivery PIN Security

PIN:

```text
4 digits
```

Verification Attempts:

```text
Max 3 attempts
```

After 3 failures:

```text
Order flagged

Restaurant must manually verify
```

Storage:

```sql
delivery_pin_attempts
```

---

# 14. JWT Strategy

Access Token:

```text
15 minutes
```

Refresh Token:

```text
7 days
```

Endpoint:

```http
POST /auth/refresh
```

Logout:

```http
POST /auth/logout
```

Implementation:

```text
Redis token blacklist
```

---

# 15. Celery Tasks

Add:

```python
cleanup_abandoned_carts_task()
```

Logic:

```python
ACTIVE cart

older than 24 hours

→ ABANDONED
```

Schedule:

```text
Daily
```

Other Tasks:

```python
send_otp_task()

send_push_notification_task()

order_status_notification_task()

cleanup_expired_otp_task()
```

---

# 16. Recommended MVP Infrastructure

For MVP:

```text
PostgreSQL

Redis

Celery

Channels
```

RabbitMQ can be removed.

Use:

```python
CELERY_BROKER_URL = REDIS_URL
```

Benefits:

* One less service
* Easier deployment
* Lower operational overhead

````

---

# 17. Deployment Notes

ASGI Required.

Recommended:

```text
Nginx
   ↓
Uvicorn
   ↓
Django
````

Processes:

```text
Web

Celery Worker

Celery Beat
```

Run separately.

---

# 18. Menu Availability Limitation

Current MVP:

```text
Menu Item

is_available = true/false
```

No slot-level availability.

Future:

```sql
menu_item_slots
```

relationship.

Example:

```text
Lunch Special

available only in Lunch
```
