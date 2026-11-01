# 🍽️ Preplate – Real-Time Food Ordering & Management Platform

Preplate is a full-stack food ordering and management platform designed to streamline order processing, scheduling, authentication, and real-time order tracking.

Built using **Django, PostgreSQL, Redis, RabbitMQ, Celery, and Next.js**, the application uses a modular monolith architecture with asynchronous task execution and real-time communication.

## 🚀 Key Features

- **OTP-Based Authentication:** Secure user authentication using OTP verification.
- **Role-Based Access Control (RBAC):** Role-based permissions to control access to different application functionalities.
- **Order Management:** Complete order lifecycle management with a structured state machine.
- **PIN-Based Order Verification:** PIN verification to validate order-related operations and eliminate manual screenshot-based payment checks.
- **Scheduled Orders:** Supports 40+ concurrent scheduled orders per day through reliable queue-based task execution.
- **Real-Time Order Tracking:** Uses Django Channels and WebSockets to provide instant order status updates.
- **Asynchronous Task Processing:** Celery and RabbitMQ handle background and scheduled tasks.
- **Centralized Caching:** Redis supports efficient caching and real-time communication infrastructure.

## 🛠️ Tech Stack

| Category | Technologies |
|---|---|
| Frontend | Next.js, React.js |
| Backend | Python, Django |
| Database | PostgreSQL |
| Caching | Redis |
| Message Broker | RabbitMQ |
| Task Queue | Celery |
| Real-Time Communication | Django Channels, WebSockets |
| Authentication | OTP, RBAC |
| Version Control | Git, GitHub |

## 🏗️ Architecture

Preplate follows a **Modular Monolith Architecture**, keeping related business logic organized into independent modules while maintaining a unified backend application.

### High-Level Architecture

```text
              ┌──────────────────┐
              │    Next.js       │
              │    Frontend      │
              └────────┬─────────┘
                       │
                HTTP / WebSocket
                       │
              ┌────────▼─────────┐
              │     Django       │
              │   Backend API    │
              └────────┬─────────┘
                       │
          ┌────────────┼─────────────┐
          │            │             │
     ┌────▼────┐  ┌────▼────┐  ┌─────▼─────┐
     │PostgreSQL│  │  Redis  │  │  Django   │
     │ Database │  │  Cache  │  │ Channels  │
     └─────────┘  └─────────┘  └───────────┘
                       │
                ┌──────▼──────┐
                │   Celery    │
                │   Workers   │
                └──────┬──────┘
                       │
                ┌──────▼──────┐
                │  RabbitMQ   │
                │Message Broker│
                └─────────────┘
```

## ⚙️ Core Technical Implementations

### 1. Scheduled Order Processing
- Implemented asynchronous task execution using Celery and RabbitMQ.
- Supports 40+ concurrent scheduled orders per day.
- Uses background workers to execute scheduled operations without blocking API requests.

### 2. Authentication & Authorization
- Implemented OTP-based user authentication.
- Integrated Role-Based Access Control (RBAC).
- Added PIN-based verification for order-related operations.

### 3. Order Lifecycle Management
- Designed an order lifecycle state machine to manage order transitions.
- Ensures structured order processing and verification.
- Reduces dependency on manual screenshot-based payment verification.

### 4. Real-Time Order Tracking
- Integrated Django Channels and WebSockets.
- Enables instant order status updates without continuous polling.
- Reduced manual coordination effort by approximately 2+ hours per day.

## 📁 Project Structure

```text
preplate/
│
├── backend/
│   └── Django backend application
│
├── frontend/
│   └── Next.js frontend application
│
├── docs/
│   └── Project documentation
│
├── .gitignore
├── AGENTS.md
└── README.md
```

## 💻 Getting Started

Follow these steps to set up the project locally.

### Prerequisites

Make sure you have the following installed:

- Python 3.10+
- Node.js and npm
- PostgreSQL
- Redis
- RabbitMQ
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/rohit1239-tech/preplate.git

cd preplate
```

### 2. Backend Setup

```bash
cd backend

python -m venv venv
```

Activate the virtual environment.

**Windows:**
```bash
venv\Scripts\activate
```

**Linux / macOS:**
```bash
source venv/bin/activate
```

Install backend dependencies:

```bash
pip install -r requirements.txt
```

Apply database migrations:

```bash
python manage.py migrate
```

Start the Django development server:

```bash
python manage.py runserver
```

### 3. Frontend Setup

Open another terminal:

```bash
cd frontend

npm install

npm run dev
```

### 4. Background Services

Make sure PostgreSQL, Redis, and RabbitMQ are running and configured.

Start a Celery worker from the backend directory:

```bash
celery -A <django_project_module> worker -l info
```

Start the Celery Beat scheduler if scheduled tasks use Celery Beat:

```bash
celery -A <django_project_module> beat -l info
```



Do not commit actual secrets, credentials, or production environment variables to GitHub.

## 📈 Project Impact

- Architected a modular monolith backend handling **40+ concurrent scheduled orders/day**.
- Implemented OTP authentication, RBAC, and PIN-based verification.
- Built real-time order tracking using Django Channels and WebSockets.
- Reduced manual order coordination effort by **2+ hours/day**.
- Implemented asynchronous background processing using Celery and RabbitMQ.

## 👨‍💻 Author

**Rohit Yengantiwar**

- GitHub: [@rohit1239-tech](https://github.com/rohit1239-tech)

---

⭐ If you find this project interesting, consider giving the repository a star!
