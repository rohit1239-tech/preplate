# Preplate

## Project Type

Food ordering platform with fixed delivery locations.

## Architecture

- Monorepo
- Backend: Django + DRF
- Frontend: Next.js
- Database: PostgreSQL
- Redis: Cache, Celery, Channels
- WebSockets: Django Channels
- JWT Authentication
- OTP Login

## Development Principles

- Follow service layer pattern.
- Business logic never goes in views.
- Use UUID primary keys.
- Use Django ORM.
- Keep implementation MVP-first.
- Prefer simplicity over abstraction.

## Backend Structure

apps/
├── accounts
├── restaurants
├── delivery_locations
├── slots
├── menus
├── cart
├── orders
├── payments
├── notifications

## Order Rules

- Orders created only via Cart checkout.
- Single restaurant per cart.
- Single slot per cart.
- Single delivery location per cart.
- Delivery PIN required.
- Order states:
  PLACED
  CONFIRMED
  PREPARING
  OUT_FOR_DELIVERY
  REACHED
  DELIVERED
  CANCELLED

## Coding Standards

- Black formatting
- Type hints
- Docstrings on services
- Fat services, thin views
- Unit tests required