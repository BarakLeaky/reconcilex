# ReconcileX

**Financial reconciliation and transaction management platform**

ReconcileX is a backend-focused financial data synchronization and reconciliation platform built with TypeScript, Node.js, and PostgreSQL.

The project is designed to organize financial data from commerce and accounting systems and provide a structured backend foundation for reconciliation workflows.

## Overview

ReconcileX focuses on the backend engineering challenges involved in working with financial transaction data across multiple systems.

The current implementation includes:

* Merchant management
* SKU cost management
* Shopify integration
* QuickBooks / Intuit OAuth support
* PostgreSQL database persistence
* Database migration support
* Environment-based configuration
* Configuration validation
* REST API endpoints

The application is structured to keep API routes, database access, configuration, and external integrations separated from one another.

## Architecture

```text
                   External Systems
                  /                \
                 /                  \
            Shopify             QuickBooks
                \                  /
                 \                /
                  v              v
                ReconcileX Backend
                        |
                +-------+-------+
                |               |
             REST API       Configuration
                |
                v
          Application Routes
          /       |        \
         /        |         \
   Merchants   Shopify   SKU Costs
         \        |         /
          \       |        /
           v      v       v
              PostgreSQL
```

## Tech Stack

| Area                   | Technology                |
| ---------------------- | ------------------------- |
| Language               | TypeScript                |
| Runtime                | Node.js                   |
| API                    | Express                   |
| Database               | PostgreSQL                |
| Database Driver        | `pg`                      |
| Validation             | Zod                       |
| Commerce Integration   | Shopify                   |
| Accounting Integration | QuickBooks / Intuit OAuth |
| Development            | `tsx`                     |
| Containers             | Docker Compose            |
| Package Manager        | npm                       |

## Project Structure

```text
reconcilex/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── migrate.ts
│   │   │   ├── pool.ts
│   │   │   └── schema.sql
│   │   ├── routes/
│   │   │   ├── merchants.ts
│   │   │   ├── shopify.ts
│   │   │   └── skuCosts.ts
│   │   ├── config.ts
│   │   └── index.ts
│   ├── .env.example
│   ├── docker-compose.yml
│   ├── package.json
│   ├── shopify.app.example.toml
│   └── tsconfig.json
├── docs/
│   └── reconcilex-technical-design.md
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

## Getting Started

### Prerequisites

Install:

* Node.js
* npm
* Docker Desktop
* Git

### Clone the repository

```bash
git clone https://github.com/BarakLeaky/reconcilex.git
cd reconcilex
```

### Install backend dependencies

```powershell
cd backend
npm install
```

### Configure environment variables

Create a local environment file from the example:

```powershell
Copy-Item .env.example .env
```

Open `.env` and provide the required local configuration values.

**Never commit `.env` or other files containing credentials or secrets.**

### Start PostgreSQL

From the `backend` directory:

```powershell
docker compose up -d
```

### Run database migrations

```powershell
npm run migrate
```

### Start the development server

```powershell
npm run dev
```

The backend uses `tsx` for development and watches the TypeScript source files for changes.

### Build the application

```powershell
npm run build
```

### Type-check the project

```powershell
npm run typecheck
```

### Start the production build

After building:

```powershell
npm run start
```

## Configuration

Application configuration is managed through environment variables.

The configuration layer validates required settings before the application starts.

Example configuration:

```text
backend/.env.example
```

Configuration covers areas including:

* Application environment
* Server port
* Database connection
* Encryption
* Shopify integration
* QuickBooks / Intuit integration
* Cost-of-goods configuration

Environment-specific values are intentionally kept outside the source code.

## Database

ReconcileX uses PostgreSQL for persistent application data.

Database-related code is located in:

```text
backend/src/db/
```

The database layer includes:

* PostgreSQL connection pooling
* Database schema definitions
* Migration logic

The database schema is maintained separately from API route implementation to keep persistence concerns isolated.

## Integrations

### Shopify

ReconcileX includes a Shopify integration for working with commerce data as part of the financial reconciliation workflow.

The relevant route implementation is:

```text
backend/src/routes/shopify.ts
```

A sanitized Shopify configuration template is provided at:

```text
backend/shopify.app.example.toml
```

Local Shopify application configuration is excluded from version control.

### QuickBooks / Intuit

The backend includes `intuit-oauth` support for authentication with Intuit services.

Integration configuration is supplied through environment variables rather than hard-coded credentials.

## API Routes

The backend organizes API functionality into separate route modules:

```text
backend/src/routes/
├── merchants.ts
├── shopify.ts
└── skuCosts.ts
```

These modules separate merchant-related operations, Shopify integration functionality, and SKU cost management from the rest of the application.

## Security

The project follows several security-oriented practices:

* Secrets are supplied through environment variables.
* `.env` files are excluded from Git.
* Local Shopify configuration is excluded from Git.
* A sanitized Shopify configuration example is provided for development.
* Configuration values are validated before use.
* External integration credentials are not hard-coded into application source files.

Sensitive credentials should be stored using environment configuration or a dedicated secret-management system in production.

## Engineering Design

The backend is organized around separation of concerns.

### API Layer

Express routes provide the HTTP interface to application functionality.

### Configuration Layer

Configuration is centralized in:

```text
backend/src/config.ts
```

Environment variables are loaded and validated before being used by the application.

### Database Layer

Database connection and migration responsibilities are isolated under:

```text
backend/src/db/
```

### Integration Layer

External-system functionality is kept within dedicated route and configuration modules, reducing coupling between external services and core database operations.

This structure is intended to make the application easier to test, maintain, and extend.

## Technical Documentation

A detailed technical architecture document is available at:

[ReconcileX Technical Design](docs/reconcilex-technical-design.md)

The document covers:

* Architecture
* Configuration and validation
* Database design
* External integrations
* Error handling
* Security considerations
* Design trade-offs
* Future engineering improvements

## Future Development

Potential areas for continued development include:

* Automated unit and integration testing
* Idempotent transaction processing
* Background reconciliation jobs
* Structured application logging
* Monitoring and observability
* CI/CD automation
* Expanded accounting integrations
* More comprehensive reconciliation workflows
* Exception and discrepancy management
* Improved integration testing

## Project Status

ReconcileX is an actively developed backend project focused on financial data synchronization and reconciliation.

The repository demonstrates practical backend engineering across:

* API development
* Database design
* External API integration
* OAuth-based authentication
* Configuration management
* Data validation
* Technical architecture

The project is being developed with an emphasis on maintainability, separation of concerns, and production-oriented engineering practices.
