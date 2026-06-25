# Implementation Plan: Shopify Clone SaaS Platform

## Overview

This implementation plan follows the **prototype-first strategy** (Requirement 36). The system is built in two major phases:

1. **Prototype Phase (Weeks 1–8):** A simplified single-server monolith demonstrating core value propositions for investor presentation. Single-tenant, no RLS, simulated payments, local storage, email/password auth only.
2. **Production Phase (Post-funding):** Full multi-tenant, distributed microservices architecture with RLS, real payment processing, Kubernetes deployment, event-driven backbone, and all production requirements.

Technology stack: TypeScript (Next.js 15, Fastify, React Native/Expo), Go (performance-critical services), PostgreSQL, Redis.

## Tasks

### PHASE 1: PROTOTYPE (8-Week Timeline, Single Server, ≤$100/month)

- [x] 1. Project scaffolding and monorepo setup
  - [x] 1.1 Initialize monorepo with Turborepo/pnpm workspaces
    - Create root `package.json` with workspace definitions
    - Set up `apps/` (admin, storefront, mobile) and `packages/` (shared types, UI components, config)
    - Configure TypeScript project references and path aliases
    - Add ESLint + Prettier shared config
    - Add Vitest as the test runner with shared configuration
    - _Requirements: 36.15, 36.16, 36.23_

  - [x] 1.2 Set up Fastify API server with unified endpoints
    - Create `apps/api/` with Fastify bootstrapping
    - Configure route prefixes: `/api/v1/admin/`, `/api/v1/storefront/`
    - Add request validation with Zod schemas
    - Add structured JSON error responses matching the ApiError interface
    - Add correlation ID middleware for request tracing
    - _Requirements: 9.1, 9.7, 36.12_

  - [x] 1.3 Set up Next.js 15 App Router for Admin Panel and Storefront
    - Create `apps/admin/` with Next.js 15 App Router
    - Create `apps/storefront/` with Next.js 15 App Router and streaming SSR
    - Configure Tailwind CSS with design tokens as CSS variables
    - Set up shared UI component package `packages/ui/`
    - _Requirements: 29.1, 29.2, 14.5, 36.23_

  - [x] 1.4 Set up React Native/Expo mobile app shell
    - Create `apps/mobile/` with Expo SDK
    - Configure EAS development client for simulator preview
    - Set up navigation structure (tabs: Home, Search, Cart, Account)
    - Connect to Storefront API base URL
    - _Requirements: 10.1, 10.4, 36.9_

  - [x] 1.5 Set up PostgreSQL database with single-tenant schema
    - Create Docker Compose for local PostgreSQL
    - Set up database migration tool (Drizzle ORM or Prisma)
    - Create initial migration with `tenants` table (schema present but no RLS)
    - Add `tenant_id` column to all tables for future production migration
    - _Requirements: 36.7, 36.21_

- [x] 2. Authentication service (email/password only)
  - [x] 2.1 Implement user registration and login endpoints
    - Create `POST /api/v1/auth/register` with email/password validation
    - Create `POST /api/v1/auth/login` returning JWT access token (15-min expiry) + refresh token (7-day lifetime)
    - Hash passwords with bcrypt (cost factor 12)
    - Create `users` table with roles: Owner, Admin, Staff, Read-Only
    - _Requirements: 21.1, 21.3, 21.4, 36.13_

  - [x] 2.2 Implement JWT token validation and refresh rotation
    - Create access token validation middleware for all protected routes
    - Create `POST /api/v1/auth/refresh` with single-use refresh token rotation
    - Invalidate old refresh token immediately upon issuing new one
    - Return HTTP 401 with machine-readable error code on invalid tokens
    - _Requirements: 21.3, 21.6, 21.10_

  - [ ]* 2.3 Write property test for token rotation invalidation
    - **Property 11: Token Rotation Invalidation**
    - **Validates: Requirements 21.3, 21.10**

  - [x] 2.4 Implement RBAC middleware and role enforcement
    - Create role-checking middleware that reads role from JWT claims
    - Enforce Owner/Admin/Staff/Read-Only permissions per route
    - Protect billing routes for Owner only, catalog for Admin+Staff
    - _Requirements: 21.4, 21.5_

- [x] 3. Database schema and product management CRUD
  - [x] 3.1 Create core database migrations for catalog domain
    - Create `products` table with title, description, status, category_id, metadata
    - Create `listings` table with SKU, price, weight, inventory_quantity, options
    - Create `categories` table with hierarchical path (LTREE), max depth 5
    - Create `media` table linking files to products (max 50 per product)
    - Add constraints: title 1-255 chars, description ≤10,000, price 0.01-999,999,999.99
    - _Requirements: 3.1, 3.2, 3.6_

  - [x] 3.2 Implement product CRUD endpoints
    - Create `POST /api/v1/admin/products` with full validation
    - Create `GET /api/v1/admin/products` with pagination (cursor-based, default 20, max 100)
    - Create `GET /api/v1/admin/products/:id` with listings and media
    - Create `PUT /api/v1/admin/products/:id` with partial update support
    - Create `DELETE /api/v1/admin/products/:id` (soft delete)
    - Return structured field-level validation errors on constraint violations
    - _Requirements: 3.1, 3.7, 8.4, 9.7_

  - [ ]* 3.3 Write property test for catalog entity constraint enforcement
    - **Property 3: Catalog Entity Constraint Enforcement**
    - **Validates: Requirements 3.1, 3.2, 3.7, 3.8**

  - [x] 3.4 Implement listing management with SKU uniqueness
    - Create `POST /api/v1/admin/products/:id/listings` (max 100 per product)
    - Enforce unique SKU within tenant scope (UNIQUE constraint on tenant_id, sku)
    - Return HTTP 409 conflict error on duplicate SKU
    - Create `PUT /api/v1/admin/listings/:id` and `DELETE /api/v1/admin/listings/:id`
    - _Requirements: 3.2, 3.4, 3.8_

  - [ ]* 3.5 Write property test for SKU uniqueness invariant
    - **Property 4: SKU Uniqueness Invariant**
    - **Validates: Requirements 3.4**

  - [x] 3.6 Implement CSV bulk import for products
    - Create `POST /api/v1/admin/products/import` accepting multipart CSV (max 10MB, 10,000 rows)
    - Parse and validate each row independently against product/listing constraints
    - Return per-row error report without aborting entire import
    - Insert valid rows, report invalid rows with field-level errors
    - _Requirements: 3.5_

  - [ ]* 3.7 Write property test for CSV import per-row validation
    - **Property 5: CSV Import Per-Row Validation**
    - **Validates: Requirements 3.5**

  - [x] 3.8 Implement category management with hierarchical depth enforcement
    - Create category CRUD endpoints with parent_id and depth validation (max 5 levels)
    - Store path using LTREE for efficient subtree queries
    - Validate category names (max 128 chars)
    - _Requirements: 3.6_

- [x] 4. Merchant onboarding and store provisioning (prototype)
  - [x] 4.1 Implement merchant registration endpoint
    - Create `POST /api/v1/auth/register-merchant` with email, password, store name, subdomain
    - Validate subdomain: 3-63 chars, lowercase alphanumeric/hyphen, start/end alphanumeric
    - Check subdomain uniqueness in tenants table
    - Create tenant record with default 'free' subscription tier
    - Create default storefront configuration
    - _Requirements: 1.1, 1.2, 1.4, 1.6_

  - [ ]* 4.2 Write property test for subdomain validation
    - **Property 1: Subdomain Validation**
    - **Validates: Requirements 1.4**

  - [x] 4.3 Implement subscription plan selection
    - Create `POST /api/v1/admin/billing/plan` to select Free/Basic/Professional/Enterprise
    - Activate feature set and resource quotas within 5 seconds
    - Store plan configuration in tenant settings JSONB
    - _Requirements: 1.5, 22.1_

  - [x] 4.4 Implement onboarding flow with default storefront creation
    - Create default storefront with pre-applied theme on registration completion
    - Generate API credentials (API key) for the merchant
    - Return complete onboarding response within 60 seconds
    - Handle rollback on partial failure (clean up partial resources)
    - _Requirements: 1.1, 1.2, 1.7_

- [ ] 5. Theme engine (basic prototype)
  - [x] 5.1 Create theme data model and default themes
    - Create `themes` table with name, template config, color palette, font config
    - Create `theme_customizations` table for merchant overlays (max 50 properties)
    - Seed 3 distinct visual themes for demo (modern, minimal, bold)
    - _Requirements: 4.1, 4.3, 36.3_

  - [ ] 5.2 Implement theme selection and preview API
    - Create `GET /api/v1/admin/themes` listing available themes
    - Create `POST /api/v1/admin/themes/:id/preview` returning rendered preview data
    - Create `POST /api/v1/admin/themes/:id/apply` publishing theme to live storefront
    - Render preview within 5 seconds, publish within 10 seconds
    - _Requirements: 4.1, 4.7_

  - [x] 5.3 Implement theme customization persistence
    - Create `PUT /api/v1/admin/themes/customize` saving overlay properties
    - Preserve merchant customizations when base theme updates (overlay pattern)
    - Support colors, fonts, and layout sections as customizable properties
    - _Requirements: 4.3, 4.4_

  - [x] 5.4 Implement theme rendering in storefront
    - Create React-based dynamic theme renderer consuming theme config
    - Load theme modules independently (dynamic imports)
    - Apply CSS variables from theme config for consistent branding
    - Fallback to previous theme if rendering fails
    - _Requirements: 4.2, 4.5, 4.6_

- [ ] 6. Cart and checkout (simulated payments)
  - [ ] 6.1 Implement cart service with inventory reservation
    - Create `POST /api/v1/storefront/cart/add` with stock validation
    - Enforce max 50 distinct line items, max 100 units per line item
    - Reserve stock for 15 minutes using in-memory store (prototype: simple Map)
    - Release expired reservations automatically
    - Create `GET /api/v1/storefront/cart`, `DELETE /api/v1/storefront/cart/items/:id`
    - _Requirements: 7.1, 7.2_

  - [ ]* 6.2 Write property test for cart constraint enforcement
    - **Property 6: Cart Constraint Enforcement**
    - **Validates: Requirements 7.1**

  - [x] 6.3 Implement checkout flow with price calculation
    - Create `POST /api/v1/storefront/checkout/initiate`
    - Calculate subtotal = Σ(unit_price × quantity) for all line items
    - Calculate tax (flat rate for prototype), shipping (flat rate for prototype)
    - Apply discount if promotion code present
    - Return itemized summary: line items, subtotal, tax, shipping, discount, total
    - _Requirements: 7.3, 7.7_

  - [ ]* 6.4 Write property test for checkout price arithmetic
    - **Property 7: Checkout Price Arithmetic**
    - **Validates: Requirements 7.3**

  - [x] 6.5 Implement simulated payment gateway
    - Create `POST /api/v1/storefront/checkout/pay` with simulated payment processing
    - Accept test card numbers, always return success for valid format
    - On success: decrement inventory atomically, create order record, return confirmation
    - On simulated failure: release reservation within 30 seconds, return error with reason
    - Send confirmation within 5 seconds of successful payment
    - _Requirements: 7.4, 7.5, 7.6, 36.8_

  - [x] 6.6 Implement order creation and order data model
    - Create `orders` table with status, totals, currency, shipping/billing address
    - Create `order_line_items` table with quantity, unit_price, fulfillment_status
    - Create `POST /api/v1/admin/orders` (list), `GET /api/v1/admin/orders/:id`
    - Support order statuses: pending, processing, shipped, delivered, returned, cancelled
    - _Requirements: 7.6, 16.2_

- [ ] 7. Checkpoint - Prototype core backend
  - Ensure all tests pass for auth, products, cart, checkout, and orders.
  - Ask the user if questions arise.

- [ ] 8. Promotion engine (prototype)
  - [ ] 8.1 Implement discount and coupon data model
    - Create `promotions` table with type, value, code, conditions, stacking rules
    - Support discount types: percentage-off (1-100%), fixed-amount, buy-X-get-Y, free-shipping
    - Add usage limits (total redemptions, per-customer)
    - _Requirements: 23.1, 23.4_

  - [x] 8.2 Implement coupon validation and discount application
    - Create `POST /api/v1/storefront/cart/apply-coupon` endpoint
    - Validate coupon code: case-insensitive, 3-32 alphanumeric characters
    - Check eligibility: min cart value, specific products, date ranges, usage limits
    - Apply discount within 200ms response time
    - Apply stacking rules (best-only default, or combinable if configured)
    - Ensure final price never goes negative
    - _Requirements: 23.2, 23.3, 23.5, 23.6, 23.7_

  - [ ]* 8.3 Write property test for coupon code validation
    - **Property 12: Coupon Code Validation**
    - **Validates: Requirements 23.3**

  - [ ]* 8.4 Write property test for discount stacking calculation
    - **Property 13: Discount Stacking Calculation**
    - **Validates: Requirements 23.5**

- [ ] 9. CRM basics (prototype)
  - [ ] 9.1 Implement customer data model and profile management
    - Create `customers` table with email, name, total_orders, total_spend, average_order_value, last_purchase_date, tags
    - Auto-create customer profile on first order (or guest checkout email capture)
    - Update profile metrics after each order: increment total_orders, update total_spend, calculate AOV
    - _Requirements: 6.1, 6.7_

  - [x] 9.2 Implement customer list and search API
    - Create `GET /api/v1/admin/customers` with pagination (50 per page)
    - Support search by name and email
    - Support filters: order frequency, total spend range, last purchase date, tags
    - Return engagement metrics on each profile
    - _Requirements: 6.2, 6.7_

  - [x] 9.3 Implement customer tagging and segment actions
    - Create `POST /api/v1/admin/customers/:id/tags` for tagging
    - Create `POST /api/v1/admin/segments` for defining customer segments
    - Log segment actions (email triggers, discount assignments) to admin panel for prototype
    - _Requirements: 6.3, 36.14_

- [ ] 10. Search and discovery (prototype - PostgreSQL full-text)
  - [ ] 10.1 Implement product search using PostgreSQL full-text search
    - Create GIN indexes on product title, description, and tags
    - Implement relevance ranking: title > description > tags
    - Return max 50 results per page with pagination metadata
    - Support autocomplete after 2+ characters (max 10 suggestions, <200ms)
    - _Requirements: 17.1, 17.4, 17.5, 17.8_

  - [x] 10.2 Implement faceted filtering
    - Support filters: category, price range, availability, custom attributes
    - Combine multiple filters with AND logic (max 10 simultaneous)
    - Return empty result set with zero count for no matches (no error)
    - Reject empty/whitespace-only queries with validation error
    - _Requirements: 17.2, 17.6, 17.7_

- [x] 11. Asset management (local filesystem for prototype)
  - [x] 11.1 Implement file upload with local storage
    - Create `POST /api/v1/admin/assets/upload` accepting multipart file
    - Validate formats: JPEG, PNG, WebP, AVIF, MP4, WebM, PDF (max 50MB)
    - Store files in local filesystem organized by tenant_id prefix
    - Generate responsive image variants: thumbnail 150×150, small 400w, medium 800w, large 1200w
    - Return reject with error for unsupported format or oversized files
    - _Requirements: 25.1, 25.2, 25.3, 25.5, 36.10_

  - [x] 11.2 Implement asset serving and transformation
    - Create `GET /api/v1/assets/:id` serving files from local storage
    - Support resize/crop query parameters (1-4096px per side)
    - Return transformed image within 3 seconds
    - Set cache-control headers for 30-day caching
    - _Requirements: 25.4, 25.7_

- [x] 12. Order fulfillment and notifications (prototype - logged to admin)
  - [x] 12.1 Implement fulfillment status management
    - Create `PUT /api/v1/admin/orders/:id/fulfill` with status transitions
    - Support statuses: pending, processing, shipped, delivered, returned, cancelled
    - Validate allowed status transitions (configurable per merchant)
    - Support partial fulfillment with fulfillment groups per line item
    - Record carrier name and tracking number per fulfillment group
    - _Requirements: 16.1, 16.2, 16.4, 16.5_

  - [x] 12.2 Implement notification logging to admin panel (prototype)
    - Create `notifications` table storing notification content
    - Log shipping notifications, status change notifications to admin panel
    - Display notification log in admin UI for merchant review
    - Retry logic placeholder (3 retries with backoff, log on final failure)
    - _Requirements: 16.1, 16.3, 16.6, 16.7, 36.14_

- [x] 13. Analytics (pre-seeded demo data)
  - [x] 13.1 Create analytics dashboard with pre-seeded data
    - Create analytics tables for page_views, product_views, add_to_cart, purchases
    - Seed demo analytics data showing revenue, conversion rate, AOV, top products
    - Create `GET /api/v1/admin/analytics/dashboard` returning pre-seeded metrics
    - Support configurable date ranges (1 day to 13 months)
    - Render dashboard within 3 seconds
    - _Requirements: 27.1, 27.2, 27.5, 27.8, 36.11_

- [ ] 14. Checkpoint - Prototype backend complete
  - Ensure all tests pass for promotions, CRM, search, assets, fulfillment, and analytics.
  - Ask the user if questions arise.

- [x] 15. Admin Panel UI
  - [x] 15.1 Implement admin layout shell and navigation
    - Create responsive sidebar navigation with sections: Dashboard, Products, Orders, Customers, Marketing, Themes, Settings
    - Implement design token system with CSS variables + Tailwind
    - Add loading indicators within 200ms of user actions
    - Ensure responsive from 320px to 2560px viewport
    - _Requirements: 29.1, 29.2, 29.5, 29.6_

  - [x] 15.2 Implement product management pages
    - Create product list page with pagination and search
    - Create product create/edit form with listing management
    - Create category management page with tree view
    - Create CSV import page with drag-drop and progress reporting
    - Show field-level validation errors, preserve form data on failures
    - _Requirements: 3.1, 3.5, 3.6, 29.6, 29.7_

  - [x] 15.3 Implement order management pages
    - Create order list with status filters and search
    - Create order detail page with line items, fulfillment actions
    - Implement fulfillment workflow: mark shipped, add tracking, partial fulfill
    - Display notification log per order
    - _Requirements: 16.1, 16.2, 16.5, 29.6_

  - [x] 15.4 Implement customer management and CRM pages
    - Create customer list with search and filters
    - Create customer detail page showing profile, order history, engagement metrics
    - Implement customer tagging and segment builder UI
    - _Requirements: 6.2, 6.7, 29.6_

  - [x] 15.5 Implement theme management and marketing pages
    - Create theme gallery showing 3 available themes with live preview
    - Create theme customization panel (colors, fonts, layout)
    - Create promotions/discounts management page
    - Create marketing email campaign page (logs to notification panel for prototype)
    - _Requirements: 4.1, 4.3, 23.1, 36.3_

  - [x] 15.6 Implement settings and billing pages
    - Create store settings page (name, subdomain, branding assets)
    - Create billing page showing current plan, upgrade/downgrade
    - Create staff management page with invite flow
    - Create webhook endpoint management page
    - _Requirements: 1.5, 22.7, 21.8, 28.1_

  - [x] 15.7 Implement analytics dashboard UI
    - Create dashboard page with revenue chart, conversion rate, AOV, top products
    - Add date range selector (1 day to 13 months)
    - Display visitor count and active cart metrics
    - Add report export button (CSV/PDF)
    - _Requirements: 27.2, 27.3, 27.5, 27.8_

- [x] 16. Web Storefront UI
  - [x] 16.1 Implement storefront layout with theme rendering
    - Create responsive storefront shell consuming theme configuration
    - Implement streaming SSR with Next.js App Router
    - Configure CSS variables from active theme for branding
    - Optimize for LCP <2.5s, TTI <3.5s, CLS <0.1 on simulated 4G
    - _Requirements: 14.1, 14.2, 14.3, 14.5, 4.2_

  - [x] 16.2 Implement product browsing and search UI
    - Create product listing page with faceted filters (category, price, availability)
    - Create product detail page with variant selection, image gallery, add-to-cart
    - Implement search bar with autocomplete (2+ chars, max 10 suggestions)
    - Serve responsive images in WebP/AVIF with srcset (320-1920px)
    - _Requirements: 17.1, 17.2, 17.5, 14.6_

  - [x] 16.3 Implement cart and checkout UI
    - Create cart drawer/page showing line items with quantity adjustment
    - Create checkout flow: shipping address → shipping method → payment → confirmation
    - Display itemized summary with tax, shipping, discounts
    - Support guest checkout (email + shipping address minimum)
    - Show coupon code input with inline validation feedback
    - _Requirements: 7.1, 7.3, 7.7, 23.3_

  - [x] 16.4 Implement accessibility and keyboard navigation
    - Ensure all interactive elements have visible focus indicators
    - Implement full keyboard navigation across all pages
    - Add ARIA labels, roles, and landmarks
    - Validate WCAG 2.1 Level AA compliance with automated scanning
    - _Requirements: 14.4, 14.7_

- [x] 17. Mobile whitelabel preview (prototype)
  - [x] 17.1 Implement mobile storefront screens
    - Create home screen with featured products and theme branding
    - Create product listing/detail screens consuming Storefront API
    - Create cart screen with quantity adjustment and checkout trigger
    - Create checkout screen with address input and simulated payment
    - Create account screen with order history
    - _Requirements: 10.4, 36.5_

  - [x] 17.2 Implement branding asset injection for whitelabel preview
    - Create branding configuration screen in admin (logo, colors, app name, splash)
    - Validate: logo PNG/SVG ≤2MB 512×512+, app name 3-30 chars, ≤6 colors, splash ≤5MB
    - Inject branding assets into pre-compiled app shell for Expo simulator preview
    - Display branded app on device simulator with merchant logo, colors, store name
    - _Requirements: 10.1, 10.2, 36.4, 36.9_

  - [x] 17.3 Implement offline handling and cached data display
    - Cache previously loaded product data for offline display
    - Show connectivity error indicator within 5 seconds of connection failure
    - Resume normal operation when connectivity is restored
    - _Requirements: 10.5_

- [x] 18. Seed data for investor demo
  - [x] 18.1 Create seed data script with demo merchants and products
    - Create 2 distinct merchant stores with unique themes and branding
    - Seed 20 products per store with listings, images, categories, and variants
    - Create sample customers with order histories and engagement metrics
    - Seed analytics data for dashboard demonstration
    - Include sample promotions/discount codes
    - _Requirements: 36.1, 36.2, 36.5, 36.6, 36.18_

  - [x] 18.2 Create investor demo walkthrough script
    - Script the 5-minute merchant onboarding journey (registration → storefront preview)
    - Script product creation with 3 listings including images and variants
    - Script theme switching across 3 themes in real-time
    - Script customer purchase journey (browse → cart → checkout → confirmation)
    - Script CRM display showing customer profile after demo purchase
    - _Requirements: 36.1, 36.2, 36.3, 36.4, 36.5, 36.6_

- [ ] 19. Checkpoint - Prototype phase complete
  - Ensure all prototype features are working end-to-end.
  - Run full test suite and verify all critical user journeys.
  - Validate demo walkthrough script executes successfully.
  - Ask the user if questions arise.

### PHASE 2: PRODUCTION BUILD (Post-Funding)

- [ ] 20. Multi-tenancy with Row-Level Security
  - [ ] 20.1 Implement RLS policies on all tenant-scoped tables
    - Add RLS policies using `current_setting('app.current_tenant')::uuid`
    - Enable RLS on: products, listings, categories, orders, order_line_items, customers, promotions, webhook_endpoints
    - Create tenant context middleware setting `app.current_tenant` per request
    - Verify zero cross-tenant data leakage with isolation tests
    - _Requirements: 2.1, 2.3, 2.6_

  - [ ]* 20.2 Write property test for tenant data isolation
    - **Property 2: Tenant Data Isolation**
    - **Validates: Requirements 2.1**

  - [ ] 20.3 Implement tenant storage partitioning
    - Migrate from local filesystem to S3 with tenant-isolated prefixes (`s3://assets/{tenant_id}/`)
    - Enforce storage operations scoped to tenant's partition only
    - Reject cross-tenant storage access attempts with authorization error
    - _Requirements: 2.2_

  - [ ] 20.4 Implement per-tenant connection pool management
    - Allocate dedicated connection pools per merchant (min 2, max 50 based on tier)
    - Implement resource quota enforcement with rate-limit errors for excess
    - Maintain <5% baseline latency impact on other tenants during throttling
    - _Requirements: 2.4, 2.5_

- [ ] 21. Production authentication (OAuth2, SSO, MFA)
  - [ ] 21.1 Implement OAuth2 bearer token authentication
    - Upgrade auth service to full OAuth2 flow with bearer tokens
    - Validate tokens at API gateway level (<50ms p99)
    - Support SSO federation: SAML 2.0 and OIDC for corporate IdPs
    - _Requirements: 21.1, 21.2, 35.1_

  - [ ] 21.2 Implement MFA enforcement for Owner/Admin roles
    - Add TOTP (authenticator app) and WebAuthn (hardware key) support
    - Require MFA for Owner and Admin roles, optional for Staff/Read-Only
    - Create MFA setup flow and recovery codes
    - _Requirements: 21.7_

  - [ ] 21.3 Implement staff invitation and session management
    - Create staff invitation system with 72-hour expiry links
    - Enforce assigned role upon acceptance
    - Reject expired invitation links with clear error message
    - Implement customer session tokens (24-hour, merchant-scoped)
    - _Requirements: 21.5, 21.8, 21.9_

- [ ] 22. API Gateway implementation
  - [ ] 22.1 Set up API Gateway (Kong/Envoy) with OAuth2 validation
    - Deploy API gateway with token validation (<50ms p99)
    - Reject invalid/expired/missing tokens with HTTP 401 (don't forward to backend)
    - Inject correlation ID for distributed tracing
    - Support request/response transformation for 2 prior API versions
    - _Requirements: 35.1, 35.2, 35.7, 35.8_

  - [ ] 22.2 Implement per-tenant rate limiting with sliding window
    - Implement 60-second sliding window rate limiter using Redis sorted sets
    - Configure tiers: Free 100rpm, Basic 500rpm, Professional 2000rpm, Enterprise 10000rpm
    - Return HTTP 429 with X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers
    - Route requests to backend based on URL path and API version (<5ms p99 routing)
    - _Requirements: 35.3, 35.4, 35.5_

  - [ ]* 22.3 Write property test for rate limiter sliding window
    - **Property 9: Rate Limiter Sliding Window**
    - **Validates: Requirements 9.3, 9.4, 35.3, 35.4**

  - [ ] 22.4 Implement circuit breaker for backend unavailability
    - Return HTTP 503 if backend doesn't respond within 3 seconds
    - Do not queue or retry requests at gateway level
    - Implement circuit breaker pattern: 5 failures → open, 30s recovery
    - _Requirements: 35.6_

- [ ] 23. GraphQL Storefront API (Apollo Federation)
  - [ ] 23.1 Set up Apollo Federation router with subgraphs
    - Create federated schema with subgraphs: Product, Cart, Checkout, Customer, Collection
    - Deploy Apollo Router with schema registry
    - Configure query depth limit (10 levels) and complexity scoring (max 1000 points)
    - Implement cursor-based pagination (default 20, max 100)
    - _Requirements: 8.1, 8.3, 8.4_

  - [ ]* 23.2 Write property test for GraphQL query depth and complexity
    - **Property 8: GraphQL Query Depth and Complexity Analysis**
    - **Validates: Requirements 8.3, 8.6**

  - [ ] 23.3 Implement cache invalidation and performance targets
    - Set up Redis-based cache layer for storefront queries
    - Invalidate cache within 2 seconds of data changes
    - Target p95 <50ms, p99 <150ms at 500 concurrent connections
    - Reject depth/complexity violations within 100ms without executing resolvers
    - _Requirements: 8.2, 8.5, 8.6_

- [ ] 24. Real payment integration (Stripe + Adyen)
  - [ ] 24.1 Implement Stripe payment gateway integration
    - Integrate Stripe SDK for payment processing (PCI-DSS compliant, tokenized)
    - Support card payments, Apple Pay, Google Pay via Stripe Elements
    - Handle payment success/failure flows with proper inventory release
    - Never store raw card data on platform servers
    - _Requirements: 7.4, 7.5, 7.6, 12.3_

  - [ ] 24.2 Implement Adyen as alternative payment gateway
    - Integrate Adyen Drop-in for alternative payment methods
    - Implement gateway selection logic per merchant configuration
    - Support automatic failover between payment providers
    - _Requirements: 7.4_

  - [ ] 24.3 Implement multi-currency support with exchange rates
    - Integrate exchange rate data provider (minimum 30 currencies, updated every 4 hours)
    - Convert prices using round-half-up to 2 decimal places
    - Support merchant-configured fixed prices per currency (override conversion)
    - Lock exchange rate at order confirmation for settlement
    - Handle provider unavailability with stale rate fallback + indicator
    - _Requirements: 24.1, 24.2, 24.3, 24.7, 24.8_

  - [ ]* 24.4 Write property test for currency conversion rounding
    - **Property 14: Currency Conversion Rounding**
    - **Validates: Requirements 24.2, 24.3**

- [ ] 25. Checkpoint - Production core services
  - Ensure all tests pass for multi-tenancy, auth, gateway, GraphQL, and payments.
  - Ask the user if questions arise.

- [ ] 26. Event-driven architecture (Kafka/SQS)
  - [ ] 26.1 Set up message broker and event topology
    - Deploy Kafka (or SQS/SNS) for domain event backbone
    - Create tenant-partitioned topics: orders, products, inventory, payments, auth
    - Configure at-least-once delivery with idempotent consumers
    - Set 72-hour retention for unavailable consumers
    - _Requirements: 19.1, 19.2, 19.5, 19.6_

  - [ ] 26.2 Implement event publishing from core services
    - Add event publishing to order service (order.created, order.updated, order.shipped)
    - Add event publishing to product service (product.created, product.updated, inventory.changed)
    - Add event publishing to payment service (payment.succeeded, payment.failed)
    - Ensure delivery within 1 second at ≤1000 events/sec
    - _Requirements: 19.3_

  - [ ] 26.3 Implement idempotent event consumers
    - Create processed_events table for deduplication
    - Implement consumers: CRM (order events), Analytics, Notifications, Search indexing
    - Implement retry: 3 attempts exponential backoff (1s, 2s, 4s), then dead-letter queue
    - _Requirements: 19.2, 19.4_

  - [ ]* 26.4 Write property test for event consumer idempotency
    - **Property 10: Event Consumer Idempotency**
    - **Validates: Requirements 19.2**

- [ ] 27. Internal service communication (gRPC)
  - [ ] 27.1 Set up Protobuf schema registry and gRPC services
    - Create shared Protobuf definitions for inter-service communication
    - Implement backward-compatible schema evolution rules (additive only)
    - Enforce mTLS on all gRPC connections between services
    - Reject connections without valid mTLS credentials within 5 seconds
    - _Requirements: 30.1, 30.2, 30.3, 30.4_

  - [ ] 27.2 Implement circuit breaker and deadline patterns
    - Implement circuit breaker: configurable threshold (default 5 failures), recovery timeout (default 30s)
    - Failure conditions: gRPC UNAVAILABLE, DEADLINE_EXCEEDED, INTERNAL
    - Fail-fast in OPEN state until recovery timeout
    - Abort requests exceeding configurable deadline (default 5s)
    - Propagate OpenTelemetry context through gRPC metadata
    - _Requirements: 30.5, 30.6, 30.7, 30.8_

- [ ] 28. Webhook delivery system
  - [ ] 28.1 Implement webhook registration and verification
    - Create `POST /api/v1/admin/webhooks` with endpoint URL and event types
    - Send HMAC-signed verification challenge, verify 2xx response within 5 seconds
    - Limit to 20 endpoints per merchant, reject excess with error
    - Support event types: order.created, product.updated, inventory.changed, etc.
    - _Requirements: 28.1, 28.7, 28.8_

  - [ ] 28.2 Implement webhook delivery with retry and HMAC signing
    - Deliver payloads within 5 seconds of event occurrence
    - Sign all payloads with HMAC-SHA256 using per-merchant secret
    - Include unique delivery ID for duplicate detection
    - Retry with exponential backoff: 1min, 5min, 30min, 2h, 24h (max 5 retries)
    - Disable endpoint after 7 consecutive days of failures, notify merchant
    - _Requirements: 28.2, 28.3, 28.4, 28.6_

  - [ ]* 28.3 Write property test for webhook HMAC signing round-trip
    - **Property 15: Webhook HMAC Signing Round-Trip**
    - **Validates: Requirements 28.4**

  - [ ] 28.4 Implement webhook delivery logs
    - Store delivery logs: payload, response status, timestamp, retry history
    - Retain last 30 days, up to 10,000 entries per endpoint
    - Expose via `GET /api/v1/admin/webhooks/:id/logs`
    - _Requirements: 28.5_

- [ ] 29. Plugin extension sandbox
  - [ ] 29.1 Implement V8 isolate sandbox for plugin execution
    - Create isolated V8 isolate execution environment per app installation
    - Enforce CPU and memory limits; terminate on violation
    - Restrict network egress to merchant-approved allowlist only
    - Block all cross-tenant data access at sandbox level
    - Log violations and notify merchant within 60 seconds
    - _Requirements: 5.1, 5.2, 5.4, 12.6_

  - [ ] 29.2 Implement plugin SDK and event hooks
    - Create typed Plugin SDK with interfaces for product, order, customer, storefront events
    - Invoke registered event hooks within 500ms of triggering event
    - Implement automated security scanning for marketplace submissions
    - Create plugin marketplace listing and approval workflow
    - _Requirements: 5.3, 5.5, 5.6_

- [ ] 30. Production search (OpenSearch)
  - [ ] 30.1 Migrate search from PostgreSQL to OpenSearch
    - Deploy OpenSearch cluster with tenant-isolated indices
    - Index products with title, description, tags, category, attributes
    - Implement relevance ranking (title > description > tags)
    - Reflect product updates in search index within 5 seconds
    - Return results with p95 <100ms for catalogs up to 100,000 products
    - _Requirements: 17.1, 17.3, 17.4_

  - [ ] 30.2 Implement advanced search features
    - Add faceted filtering: category, price range, availability, custom attributes
    - Implement autocomplete with minimum 2 chars, max 10 suggestions, <200ms
    - Support AND logic for multiple filters (max 10 simultaneous)
    - Add pagination metadata: total count, current page, total pages
    - _Requirements: 17.2, 17.5, 17.6, 17.7, 17.8_

- [ ] 31. Inventory and warehouse management
  - [ ] 31.1 Implement multi-location inventory management
    - Create `inventory_locations` table (max 50 per merchant)
    - Create `inventory_levels` table with available, reserved, incoming per location
    - Implement inventory allocation: closest location with sufficient stock
    - Split fulfillment across fewest locations when single location insufficient
    - Decrement inventory atomically on order confirmation (prevent overselling)
    - _Requirements: 34.1, 34.2, 34.3, 34.4_

  - [ ]* 31.2 Write property test for inventory allocation optimization
    - **Property 17: Inventory Allocation Optimization**
    - **Validates: Requirements 34.2, 34.3**

  - [ ]* 31.3 Write property test for concurrent inventory atomicity
    - **Property 18: Concurrent Inventory Atomicity**
    - **Validates: Requirements 34.4**

  - [ ] 31.4 Implement inventory transfer and stock management
    - Create inventory transfer endpoint between locations
    - Validate transfer quantity does not exceed source available stock
    - Record transfers in audit log (source, destination, quantity, user, timestamp)
    - Mark listings out-of-stock within 1 second when inventory reaches zero
    - Release unredeemed reservations after 7 days
    - _Requirements: 34.5, 34.6, 34.7, 34.8, 34.9_

- [ ] 32. Shipping and tax calculation
  - [ ] 32.1 Implement carrier rate integration and tax engines
    - Integrate carrier APIs: UPS, FedEx, USPS, DHL for real-time shipping rates
    - Support merchant-configured flat/weight-based rate fallbacks
    - Integrate TaxJar/Avalara for jurisdiction-aware tax calculation
    - Present available shipping methods sorted by price within 2 seconds
    - _Requirements: 33.1, 33.2, 33.3_

  - [ ] 32.2 Implement tax exemptions and fallback handling
    - Support tax-exempt marking per customer or product category
    - Apply zero tax for exempt items with status indication
    - On rate lookup failure: use cached rates ≤24h, flag order for review
    - Block checkout if no shipping methods available or cached rates >24h stale
    - Generate monthly/annual tax reports per jurisdiction (within 48h of period end)
    - _Requirements: 33.4, 33.5, 33.6, 33.7, 33.8_

- [ ] 33. Checkpoint - Production services layer
  - Ensure all tests pass for events, gRPC, webhooks, plugins, search, inventory, shipping/tax.
  - Ask the user if questions arise.

- [ ] 34. Notification service (production: email, push, SMS)
  - [ ] 34.1 Implement email delivery with provider failover
    - Integrate configurable email providers: SES, SendGrid, Postmark
    - Automatic failover after 3 consecutive failures or 10s unreachable
    - Send transactional emails within 30 seconds of order status change
    - Support customizable templates with merchant branding and dynamic placeholders
    - Retry 3 times with exponential backoff (max 15 min), log on final failure
    - _Requirements: 32.1, 32.2, 32.3, 32.7_

  - [ ] 34.2 Implement push notifications and delivery tracking
    - Send push notifications to merchant whitelabel app within 60 seconds of status change
    - Track delivery metrics: sent, delivered, opened, bounced (update within 5 min)
    - Mark hard-bounced emails as invalid, suppress marketing but continue transactional
    - Implement marketing campaign sending at max 100 emails/sec per merchant
    - _Requirements: 32.4, 32.5, 32.6, 32.8_

- [ ] 35. Merchant billing and subscription management
  - [ ] 35.1 Implement subscription plans and billing integration
    - Integrate Stripe Billing for recurring payment processing
    - Support tiers: Free, Basic, Professional, Enterprise with defined quotas
    - Calculate prorated charges on plan upgrade/downgrade
    - Apply new plan features within 60 seconds of payment confirmation
    - _Requirements: 22.1, 22.2, 22.5_

  - [ ] 35.2 Implement billing lifecycle management
    - Generate monthly invoices (base subscription + overage + marketplace fees)
    - Deliver invoices to merchant email within 24 hours
    - Retry failed payments: day 1, day 3, day 7; restrict to read-only after all fail
    - Preserve data for 30 days after account restriction
    - Send threshold warnings at 80% of plan quotas, apply overage rates at 100%
    - _Requirements: 22.3, 22.4, 22.6_

  - [ ] 35.3 Implement self-service billing portal
    - Invoice history (past 12 months)
    - Payment method management (add/remove)
    - Usage dashboards (updated every 4 hours) showing consumption vs plan limits
    - Handle subscription cancellation: maintain access until cycle end, final invoice, downgrade to Free
    - _Requirements: 22.7, 22.8_

- [ ] 36. Custom domain management
  - [ ] 36.1 Implement domain registration and DNS verification
    - Create `POST /api/v1/admin/domains` for custom domain registration
    - Validate domain ownership via DNS TXT record verification (<5 minutes)
    - Auto-provision and renew TLS certificates (Let's Encrypt/ACM)
    - Alert merchant 14 days before expiration if renewal fails, retry daily
    - _Requirements: 26.1, 26.2, 26.5_

  - [ ] 36.2 Implement SNI-based routing for custom domains
    - Route requests to correct merchant storefront using SNI-based lookup
    - Support multiple domains per storefront (primary + redirect domains)
    - Achieve p99 <10ms for domain routing lookups
    - _Requirements: 26.3, 26.4, 26.6_

- [ ] 37. Full mobile whitelabel build pipeline
  - [ ] 37.1 Implement EAS Build pipeline for production
    - Replace pre-compiled shell with full EAS Build compilation
    - Compile iOS + Android bundles, publish to TestFlight + Play Internal Testing within 30 minutes
    - Validate branding assets before build trigger
    - Auto-retry on failure; diagnostic report within 5 minutes
    - If retry fails: notify merchant, preserve logs for 7 days
    - _Requirements: 10.1, 10.3, 10.7, 10.8_

  - [ ] 37.2 Implement OTA updates with code signing and staged rollout
    - Push OTA updates via EAS Update within 5 minutes of storefront config change
    - Deliver updates only to specific merchant's app users (tenant-scoped)
    - Verify code signing before applying updates; discard on failure
    - Auto-rollback on 2 consecutive crash launches
    - Support staged rollout: 1% → 10% → 50% → 100% with manual advance/rollback
    - Reject bundles exceeding 50MB
    - Track OTA adoption rate per update (refresh every 5 minutes)
    - _Requirements: 31.1, 31.2, 31.3, 31.4, 31.5, 31.6, 31.7_

  - [ ]* 37.3 Write property test for OTA code signing verification
    - **Property 16: OTA Code Signing Verification**
    - **Validates: Requirements 31.3**

  - [ ] 37.4 Implement backward-compatible API versioning for mobile
    - Maintain backward compatibility for published app versions (minimum 6 months)
    - Support API version negotiation from mobile client
    - _Requirements: 10.6_

- [ ] 38. Production analytics (real-time)
  - [ ] 38.1 Implement real-time analytics collection and aggregation
    - Deploy event collection pipeline for page_views, product_views, add_to_cart, purchases
    - Aggregate in real-time with max 30-second delay
    - Display visitor count and active carts with max 10-second staleness
    - Enforce tenant isolation at query layer
    - _Requirements: 27.1, 27.4, 27.5_

  - [ ] 38.2 Implement analytics dashboard and reporting
    - Revenue, conversion rate, AOV, top 10 products for configurable date ranges
    - Generate CSV/PDF report exports within 60 seconds (up to 1M rows)
    - Retain raw event data 13 months, aggregated data 36 months
    - Handle export failures gracefully with error message and partial data retention
    - Render dashboard within 3 seconds
    - _Requirements: 27.2, 27.3, 27.6, 27.7, 27.8_

- [ ] 39. Localization and content translation
  - [ ] 39.1 Implement multi-language content support
    - Support content localization in minimum 20 languages
    - Serve translated content based on customer's locale preference
    - Fallback to merchant's default language if translation unavailable
    - Store translations for product descriptions, UI labels, transactional emails
    - _Requirements: 24.4, 24.5, 24.6_

- [ ] 40. Checkpoint - Production features complete
  - Ensure all tests pass for notifications, billing, domains, mobile pipeline, analytics, localization.
  - Ask the user if questions arise.

- [ ] 41. Security and compliance hardening
  - [ ] 41.1 Implement encryption and PCI-DSS compliance
    - Enable AES-256 encryption at rest for all data stores (Aurora, S3)
    - Enforce TLS 1.3 for all external connections
    - Implement mTLS for all internal gRPC service-to-service communication
    - Verify PCI-DSS Level 1: no raw card data stored anywhere
    - _Requirements: 12.1, 12.2, 12.3_

  - [ ] 41.2 Implement GDPR and CCPA data handling
    - Implement GDPR right-to-erasure: anonymize personal data within 30 days
    - CRM anonymization within 72 hours with merchant notification
    - Implement CCPA data export (machine-readable, within 45 days)
    - Implement opt-out mechanism (stop data sale/sharing within 15 business days)
    - _Requirements: 12.4, 12.5, 6.5_

  - [ ] 41.3 Implement audit logging and security scanning
    - Log all security-relevant events with 12-month retention
    - Events: auth failures, privilege escalations, encrypted data access, ACL changes, sandbox violations
    - Implement automated STRIDE threat modeling in deployment pipeline
    - Block deployment on unresolved critical/high-severity threats
    - _Requirements: 12.7, 12.8_

- [ ] 42. Observability and monitoring
  - [ ] 42.1 Implement distributed tracing and metrics
    - Instrument all services with OpenTelemetry distributed tracing
    - Propagate trace context across service boundaries
    - Expose Prometheus metrics: request rate, error rate, p50/p95/p99 latency, CPU%, memory%
    - Ship structured JSON logs to centralized store (90-day retention)
    - _Requirements: 13.1, 13.2, 13.3_

  - [ ] 42.2 Implement alerting and deployment safety
    - Alert on-call within 60 seconds when error rate >1% over 5-minute window
    - Auto-rollback canary/blue-green if error rate >5% over 2-minute observation
    - Configure canary and blue-green deployment strategies with traffic routing
    - _Requirements: 13.4, 13.5, 13.6_

- [ ] 43. Infrastructure as Code (Terraform + Kubernetes)
  - [ ] 43.1 Create Terraform modules for cloud infrastructure
    - Create modules: networking, database (Aurora), kubernetes (EKS), messaging (Kafka/SQS), storage (S3), cache (Redis), search (OpenSearch), monitoring, dns
    - Remote state with locking (S3 + DynamoDB)
    - Create environments: dev, staging, production (structurally identical, different sizing)
    - _Requirements: 18.1, 18.4_

  - [ ] 43.2 Configure Kubernetes deployment with HPA and HA
    - Deploy containerized services on EKS with HPA (min 2, max 10 replicas, target CPU 70%)
    - Deploy across 3 availability zones with automatic failover <30 seconds
    - Configure Aurora Global Database (RPO=0 for single-zone failure, RTO <15 min cross-region)
    - Configure read replicas for storefront traffic (keep primary CPU <70%)
    - _Requirements: 18.2, 11.1, 11.3, 11.4, 11.5, 11.6_

  - [ ] 43.3 Implement auto-scaling and flash sale support
    - Configure flash sale detection: custom metrics trigger pre-scaling to 20x baseline within 60s
    - Maintain p95 <500ms and error rate <0.1% during flash sales
    - Fallback: rate limiting if scaling fails within 60 seconds, notify operator
    - _Requirements: 11.2, 11.7_

- [ ] 44. CI/CD pipeline
  - [ ] 44.1 Implement GitHub Actions CI/CD with ArgoCD
    - PR checks: unit + integration + lint within 10 minutes
    - Block merge on any test or lint failure
    - Build container images and deploy to staging within 15 minutes of merge
    - _Requirements: 18.3, 18.6, 20.4, 20.5_

  - [ ] 44.2 Implement production deployment with canary and soak tests
    - Canary deployment: 5% traffic, 2-minute observation window
    - Auto-rollback on >5% error rate
    - Promote to production after 30-minute soak with <1% errors
    - Auto-rollback if 5xx rate exceeds 5% within 10 minutes post-deploy
    - _Requirements: 18.5, 18.7, 13.5_

- [ ] 45. Developer experience and API documentation
  - [ ] 45.1 Implement interactive API documentation and SDKs
    - Generate interactive API docs from OpenAPI specs with request/response examples
    - Publish typed SDKs for TypeScript and Go covering all public API operations
    - Provide sandbox environment per developer with isolated test data
    - Publish changelog and maintain deprecated endpoints for 12 months minimum
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [ ] 45.2 Implement webhook delivery with at-least-once semantics
    - Exponential backoff retry for webhook delivery
    - Delivery logs accessible to merchants
    - Versioned API endpoint support (/v1/, /v2/) with 12-month deprecation window
    - _Requirements: 15.5, 9.5, 9.8_

- [ ] 46. Production data management and CRM enhancements
  - [ ] 46.1 Implement CRM data retention and GDPR compliance
    - Retain customer interaction history for minimum 3 years
    - Implement customer segment automated actions (email triggers, discounts) within 10 minutes
    - CRM profile update retry: 3 times, notify merchant on failure for manual reconciliation
    - _Requirements: 6.3, 6.4, 6.6_

- [ ] 47. Load testing and performance validation
  - [ ] 47.1 Implement load test suite
    - Create k6/Artillery load test scripts simulating 20x traffic spikes
    - Validate: Storefront API p95 <50ms, Admin API p95 <150ms, Search p95 <100ms
    - Validate: LCP <2.5s, TTI <3.5s, CLS <0.1 on simulated 4G
    - Validate: flash sale ramp from baseline to 20x in 60 seconds
    - Run before each major release; pass only if targets met with <1% error rate
    - _Requirements: 20.6, 11.2, 14.1, 14.2, 14.3_

- [ ] 48. End-to-end test suite
  - [ ] 48.1 Implement Playwright E2E tests for web flows
    - Merchant signup → store creation → product setup
    - Customer browse → search → add to cart → checkout → payment
    - Theme selection → preview → publish
    - Admin panel CRUD operations and responsive layout verification
    - Require 100% pass rate for critical journeys
    - _Requirements: 20.3, 20.7_

  - [ ] 48.2 Implement mobile E2E tests (Detox/Maestro)
    - Mobile: browse → cart → checkout on branded whitelabel app
    - Offline mode → connectivity indicator → data recovery
    - OTA update delivery and application verification
    - _Requirements: 20.3, 20.7_

- [ ] 49. Final checkpoint - Production system complete
  - Ensure all tests pass across the entire production system.
  - Validate all 36 requirements are covered by implementation.
  - Run full load test suite and verify performance budgets are met.
  - Run E2E test suite with 100% pass rate on critical journeys.
  - Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- **Phase 1 (Prototype)**: Tasks 1–19 deliver the investor demo on a single server within 8 weeks at ≤$100/month
- **Phase 2 (Production)**: Tasks 20–49 implement full production architecture post-funding
- The prototype preserves all API contracts, UI components, and user journeys for production reuse (Requirement 36.20, 36.23)
- Same technology stack throughout: TypeScript, Next.js 15, Fastify, React Native/Expo, PostgreSQL

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.5"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["2.1", "3.1"] },
    { "id": 3, "tasks": ["2.2", "2.4", "3.2", "3.8"] },
    { "id": 4, "tasks": ["2.3", "3.3", "3.4", "4.1"] },
    { "id": 5, "tasks": ["3.5", "3.6", "4.2", "4.3"] },
    { "id": 6, "tasks": ["3.7", "4.4", "5.1"] },
    { "id": 7, "tasks": ["5.2", "5.3", "6.1"] },
    { "id": 8, "tasks": ["5.4", "6.2", "6.3"] },
    { "id": 9, "tasks": ["6.4", "6.5", "6.6", "8.1"] },
    { "id": 10, "tasks": ["8.2", "9.1", "10.1"] },
    { "id": 11, "tasks": ["8.3", "8.4", "9.2", "9.3", "10.2", "11.1"] },
    { "id": 12, "tasks": ["11.2", "12.1", "13.1"] },
    { "id": 13, "tasks": ["12.2", "15.1"] },
    { "id": 14, "tasks": ["15.2", "15.3", "15.4", "15.5"] },
    { "id": 15, "tasks": ["15.6", "15.7", "16.1"] },
    { "id": 16, "tasks": ["16.2", "16.3", "16.4"] },
    { "id": 17, "tasks": ["17.1", "17.2"] },
    { "id": 18, "tasks": ["17.3", "18.1"] },
    { "id": 19, "tasks": ["18.2"] },
    { "id": 20, "tasks": ["20.1", "20.3"] },
    { "id": 21, "tasks": ["20.2", "20.4", "21.1"] },
    { "id": 22, "tasks": ["21.2", "21.3", "22.1"] },
    { "id": 23, "tasks": ["22.2", "22.4", "23.1"] },
    { "id": 24, "tasks": ["22.3", "23.2", "23.3", "24.1"] },
    { "id": 25, "tasks": ["24.2", "24.3"] },
    { "id": 26, "tasks": ["24.4", "26.1"] },
    { "id": 27, "tasks": ["26.2", "26.3", "27.1"] },
    { "id": 28, "tasks": ["26.4", "27.2", "28.1"] },
    { "id": 29, "tasks": ["28.2", "28.4", "29.1"] },
    { "id": 30, "tasks": ["28.3", "29.2", "30.1"] },
    { "id": 31, "tasks": ["30.2", "31.1"] },
    { "id": 32, "tasks": ["31.2", "31.3", "31.4", "32.1"] },
    { "id": 33, "tasks": ["32.2", "34.1"] },
    { "id": 34, "tasks": ["34.2", "35.1"] },
    { "id": 35, "tasks": ["35.2", "35.3", "36.1"] },
    { "id": 36, "tasks": ["36.2", "37.1"] },
    { "id": 37, "tasks": ["37.2", "37.4"] },
    { "id": 38, "tasks": ["37.3", "38.1"] },
    { "id": 39, "tasks": ["38.2", "39.1"] },
    { "id": 40, "tasks": ["41.1", "41.2"] },
    { "id": 41, "tasks": ["41.3", "42.1"] },
    { "id": 42, "tasks": ["42.2", "43.1"] },
    { "id": 43, "tasks": ["43.2", "43.3"] },
    { "id": 44, "tasks": ["44.1"] },
    { "id": 45, "tasks": ["44.2", "45.1"] },
    { "id": 46, "tasks": ["45.2", "46.1"] },
    { "id": 47, "tasks": ["47.1", "48.1"] },
    { "id": 48, "tasks": ["48.2"] }
  ]
}
```
