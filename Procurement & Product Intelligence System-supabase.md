# Procurement & Product Intelligence System

## Greenfield Architecture – Supabase + Cloudflare

---

# 1. Overview

This document defines the full technical and product specification for a new-generation procurement and product intelligence platform built from the ground up using modern cloud-native architecture.

This is a **greenfield project**, not a migration. The system is designed to scale from a single retail business to a multi-branch, data-driven, and AI-enabled procurement platform.

Core goals:

* Fast procurement
* Offline-first reliability
* Scalable cloud backend
* Structured product intelligence
* Long-term support for automation and AI

The platform is optimized for:

* Mobile-first use
* High SKU turnover
* Unstable network environments
* Real-world wholesale procurement

---

# 2. Vision

The system will evolve from a procurement tool into a full operational platform:

Phase evolution:

1. Procurement capture
2. Product database
3. Inventory and POS
4. Analytics and optimization
5. AI-driven procurement
6. Automated supply chain

---

# 3. Core Principles

## 3.1 Offline-first

The system must function reliably without internet.

## 3.2 Speed over perfection

The design prioritizes high throughput during procurement.

## 3.3 Minimal cognitive load

UI and workflow must be optimized for rapid input.

## 3.4 Scalable from day one

Architecture must support growth without re-platforming.

## 3.5 Modular and extensible

Every layer must support future expansion.

---

# 4. High-Level Architecture

## 4.1 System Flow

User (Mobile PWA)
↓
Cloudflare Pages (Frontend + CDN)
↓
Supabase (Database + Storage + Auth)

Offline layer:

User → IndexedDB → Sync Engine → Supabase

---

# 5. Technology Stack

## 5.1 Frontend

* HTML
* Tailwind CSS
* JavaScript (modular)
* IndexedDB
* Service Worker
* Progressive Web App

Hosted globally on Cloudflare Pages.

## 5.2 Backend

Supabase provides:

* PostgreSQL
* Object storage
* Authentication
* Row-level security
* Realtime subscriptions

---

# 6. Product Scope

## 6.1 Initial Modules

* Procurement capture
* Supplier management
* Model database
* Historical pricing

## 6.2 Future Modules

* Inventory
* POS
* Analytics
* Forecasting
* Automation

---

# 7. Offline Procurement System

## 7.1 Capture Modes

### Single

Immediate upload.

### Batch

Store locally and upload later.

---

## 7.2 Batch Workflow

1. Select supplier
2. Open camera
3. Capture
4. Enter model and price
5. Store locally
6. Continue
7. Sync later

---

# 8. Local Storage Architecture

## 8.1 IndexedDB Queue

Each item contains:

```
{
  id,
  requestId,
  imageBlob,
  model,
  price,
  supplier,
  timestamp,
  status,
  retryCount,
  uploadPointer
}
```

---

## 8.2 Status Lifecycle

* pending
* uploading
* success
* failed

---

# 9. Image Pipeline

## 9.1 Compression Requirements

* JPEG
* Max 1200px width
* 150–250 KB
* Metadata removed

## 9.2 Pipeline

Capture → Resize → Adaptive Compression → Blob → IndexedDB

---

# 10. Synchronization Engine

## 10.1 Upload Flow

1. Upload image to Supabase Storage
2. Get public URL
3. Insert record
4. Remove local data

## 10.2 Retry Strategy

* Sequential
* Resume
* Automatic

---

# 11. Supabase Database Design

## 11.1 Core Tables

### procurement

* id
* timestamp
* supplier_id
* model_id
* price
* image_url
* model_code

### suppliers

* id
* name
* created_at

### models

* id
* name
* first_seen

---

# 12. Storage Architecture

Supabase Storage structure:

```
supplier/year/month/
```

Future support:

* Versioning
* Image classification

---

# 13. Authentication and Roles

Future-ready role system:

* Owner
* Procurement staff
* Cashier
* Manager

Row-level security ensures data isolation.

---

# 14. Frontend Architecture

Recommended structure:

```
src/
  index.html
  main.js

  modules/
    camera.js
    batch.js
    compression.js
    sync.js
    db.js
    api.js

  components/
  pages/
```

---

# 15. Performance Targets

* Capture under 1 second
* 100-item batch stability
* Upload success above 99%

---

# 16. Security

The system must:

* Encrypt traffic
* Protect storage
* Use secure API keys
* Apply strict access rules

---

# 17. Monitoring

Track:

* Upload success
* Retry
* Image size
* Crash frequency

---

# 18. Scalability

The platform must support:

* Multi-branch
* Large SKU databases
* Real-time dashboards
* AI integration

---

# 19. Analytics and Intelligence

Future analytics:

* Supplier performance
* Price trends
* Product lifecycle

---

# 20. AI Roadmap

## Phase 1

Data foundation.

## Phase 2

Demand forecasting.

## Phase 3

Computer vision.

## Phase 4

Automated procurement.

---

# 21. Backup and Recovery

* Automated database backups
* Storage redundancy
* Versioning

---

# 22. Acceptance Criteria

The system is production-ready when:

* Offline capture stable
* No data loss
* Scalable
* Secure

---

# 23. Detailed Database Schema & ERD

This section defines a production-grade relational design with strict field definitions, constraints, and relationships to prevent future scaling and data integrity issues.

---

## 23.1 Design Principles

The schema must:

* Ensure strong data integrity
* Prevent duplication and ambiguity
* Support analytics and forecasting
* Maintain historical truth
* Scale to millions of records

Key rules:

* UUID primary keys
* Foreign key enforcement
* Immutable procurement history
* Strict normalization of core entities

---

## 23.2 Core Entities

* organizations
* users
* suppliers
* models
* procurement
* procurement_images
* inventory (future)

---

## 23.3 Organizations

Table: organizations

Fields:

* id (uuid, PK, default gen_random_uuid())
* name (text, required)
* created_at (timestamp, default now())

Constraints:

* name unique per tenant cluster (future SaaS)

---

## 23.4 Users

Table: users

Fields:

* id (uuid, PK, references auth.users.id)
* organization_id (uuid, FK → organizations.id, required)
* role (text, required)
* name (text)
* created_at (timestamp default now())

Role enum:

* owner
* manager
* staff

Indexes:

* organization_id

Notes:

The organization_id is embedded into JWT custom claims.

---

## 23.5 Suppliers

Table: suppliers

Fields:

* id (uuid, PK)
* organization_id (uuid, FK)
* name (text, required)
* phone (text, nullable)
* location (text, nullable)
* notes (text)
* created_at

Constraints:

* unique (organization_id, lower(name))

Indexes:

* organization_id

Reason:

Avoid duplicate suppliers caused by inconsistent naming.

---

## 23.6 Models

Table: models

Fields:

* id (uuid, PK)
* organization_id (uuid, FK)
* name (text, required)
* normalized_name (text, required)
* category (text)
* gender (text)
* first_seen (timestamp)
* created_at

Constraints:

* unique (organization_id, normalized_name)

Indexes:

* organization_id
* normalized_name

Notes:

normalized_name = lowercase, trimmed.
This prevents duplicates and enables fast search.

---

## 23.7 Procurement (Core Ledger)

Table: procurement

Fields:

* id (uuid, PK)
* organization_id (uuid, FK)
* supplier_id (uuid, FK)
* model_id (uuid, FK)
* request_id (uuid, unique)
* price (numeric, required)
* currency (text default 'IDR')
* quantity (int default 1)
* total_amount (numeric generated)
* captured_by (uuid FK users.id)
* captured_at (timestamp default now())
* device_id (text)
* batch_id (uuid)

Constraints:

* request_id unique
* price > 0

Indexes:

* organization_id
* supplier_id
* model_id
* captured_at desc

Notes:

Append-only ledger. No updates except correction tables.

---

# 23.8 Procurement Images (Updated for Cloudflare R2)

This table stores metadata for all images related to procurement records. The design has been updated to align with **Cloudflare R2 object storage** and secure signed URL access.

The purpose of this table is to decouple image storage from the core procurement ledger while maintaining flexibility, security, and future scalability.

---

## Objectives

The image architecture must:

* Support Cloudflare R2 signed URL access
* Prevent direct public exposure of storage
* Enable versioning and multiple image variants
* Support future AI and analytics
* Enable monitoring and cost control
* Maintain strong multi-tenant isolation

---

## Key Design Change (Compared to Earlier Version)

The previous design stored a `public_url`. This is no longer recommended.

Because Cloudflare R2 uses **short-lived signed URLs**, storing permanent public URLs is:

* Insecure
* Fragile
* Not future-proof

Instead, the database stores only the **storage path**. The Cloudflare Worker dynamically generates access URLs.

---

## Table Definition

```sql
create table public.procurement_images (
  id uuid primary key default gen_random_uuid(),

  procurement_id uuid not null references public.procurement(id) on delete cascade,

  organization_id uuid not null,

  storage_path text not null,

  content_type text,

  file_size integer,

  variant text default 'original',

  created_at timestamptz default now()
);
```

---

## Field Description

### id

Unique identifier.

### procurement_id

Links the image to the immutable procurement record.

### organization_id

Used for tenant isolation and RLS.

### storage_path

The canonical reference to the object in Cloudflare R2.

Example:

```
organization_id/supplier_id/year/month/request_id.jpg
```

This path is used by the Cloudflare Worker to generate signed URLs.

### content_type

Stores MIME type such as:

* image/jpeg
* image/webp

This supports validation, browser behavior, and future pipelines.

### file_size

Used for:

* Cost monitoring
* Compression optimization
* Anomaly detection

### variant

Supports multiple image derivatives.

Examples:

* original
* thumbnail
* compressed
* ai-processed

This enables efficient viewing and future AI workflows.

### created_at

Audit and monitoring.

---

## Constraints and Indexing

Prevent duplicate variants:

```sql
create unique index uniq_procurement_variant
on public.procurement_images (procurement_id, variant);
```

Indexes for performance:

```sql
create index idx_proc_img_org
on public.procurement_images (organization_id);

create index idx_proc_img_proc
on public.procurement_images (procurement_id);
```

---

## Row Level Security

Enable RLS:

```sql
alter table public.procurement_images enable row level security;
```

Select policy:

```sql
create policy "select own images"
on public.procurement_images
for select
using (
  organization_id = (auth.jwt() ->> 'organization_id')::uuid
);
```

Insert policy:

```sql
create policy "insert own images"
on public.procurement_images
for insert
with check (
  organization_id = (auth.jwt() ->> 'organization_id')::uuid
);
```

Updates and deletes should generally be restricted to backend workflows.

---

## Backend Flow

1. Client uploads image to Cloudflare R2 using a signed URL.
2. After successful upload, the client or backend inserts a row into this table.
3. Viewing requests fetch storage_path.
4. Cloudflare Worker generates a short-lived signed download URL.

This ensures:

* Security
* Scalability
* Vendor independence

---

## Future Extensions

This design supports:

* AI model training
* Visual similarity search
* Automated tagging
* Image quality scoring
* Lifecycle and archival policies

---

End of Section 23.8.

---

## 23.9 Future Inventory (Preview)

Tables:

* inventory
* stock_movements

Stock movements must reference procurement.

---

## 23.10 Relationships Overview

organizations
→ users
→ suppliers
→ models
→ procurement

suppliers → procurement
models → procurement
procurement → procurement_images

This structure supports:

* price trend analysis
* supplier performance
* model lifecycle

---

# 24. Indexing and Performance Strategy

Critical indexes:

* (organization_id, captured_at)
* (organization_id, model_id)
* (organization_id, supplier_id)

Future:

* materialized views
* partitioning by time

---

# 25. Row Level Security (RLS) – Production Design

This section defines a hardened multi-tenant security architecture for Supabase. The goal is strict tenant isolation, predictable access control, and long-term SaaS readiness.

---

## 25.1 Security Objectives

The RLS system must:

* Guarantee tenant isolation
* Prevent cross-organization data leakage
* Support role-based workflows
* Enable future SaaS expansion
* Avoid security misconfiguration

---

## 25.2 Identity and Claims

Supabase Auth is the source of identity.

Each authenticated user must have custom JWT claims:

* organization_id
* role

Example:

```
{
  "sub": "user_uuid",
  "organization_id": "org_uuid",
  "role": "staff"
}
```

This claim is injected during login or onboarding.

---

## 25.3 Core RLS Pattern

All tenant-scoped tables must enforce:

```
organization_id = (auth.jwt() ->> 'organization_id')::uuid
```

This rule applies to:

* procurement
* suppliers
* models
* procurement_images
* inventory (future)

---

## 25.4 Base Access Rules

### SELECT

Users can only read rows from their organization.

### INSERT

The inserted organization_id must match the user claim.

### UPDATE

Allowed only for:

* manager
* owner

### DELETE

Restricted to:

* owner

---

## 25.5 Role Enforcement

Roles are validated inside policies:

Example:

```
(auth.jwt() ->> 'role') IN ('manager','owner')
```

This enables:

* Delegation
* Workflow safety
* Controlled data modification

---

## 25.6 Ledger Protection

The procurement table is append-only.

Policies:

* UPDATE disabled except correction workflows
* DELETE disabled for all except system-level maintenance

This ensures historical accuracy.

---

## 25.7 Correction Strategy

Corrections must be recorded as new adjustment entries.

Example:

* price correction
* quantity correction

This supports:

* audit
* traceability

---

## 25.8 Backend Service Role

The Supabase service role must only be used in:

* automation
* batch maintenance
* scheduled jobs

Never exposed to frontend.

---

## 25.9 Security Best Practices

* RLS enabled on all tables
* No public access
* No broad policies
* Regular policy audits

---

# 26. Cloudflare R2 Storage Architecture

This section defines the production-ready storage architecture using **Cloudflare R2** as the primary object storage layer. This replaces Supabase Storage to achieve lower cost, higher scalability, and global edge performance.

The design supports:

* High-volume image capture
* Offline-first synchronization
* Multi-tenant isolation
* Secure upload and access
* AI and analytics readiness

---

## 26.1 Storage Objectives

The storage system must:

* Prevent cross-tenant access
* Support high batch throughput
* Minimize cost and egress
* Provide global low-latency delivery
* Enable future AI and analytics
* Support long-term archival

Cloudflare R2 is selected due to:

* Zero egress to internet
* Global edge network
* S3-compatible API
* Low cost at scale

---

## 26.2 Architecture Overview

The storage layer is decoupled from the database.

High-level flow:

```
Capture → Compression → IndexedDB → Sync Engine
        → Signed Upload → Cloudflare R2
        → URL stored in Supabase
```

Supabase stores only:

* Metadata
* Storage path
* Public or signed URL reference

This ensures database scalability.

---

## 26.3 Bucket Design

Primary bucket:

```
procurement-images
```

Characteristics:

* Private
* No public listing
* Access via signed URLs only
* Versioning enabled

---

## 26.4 Folder Hierarchy

All files must follow a strict tenant-scoped structure:

```
organization_id/supplier_id/year/month/request_id.jpg
```

Example:

```
org_123/sup_456/2026/02/uuid.jpg
```

Benefits:

* Strong tenant isolation
* Predictable access
* Efficient lifecycle management
* Analytics-ready structure

---

## 26.5 Idempotent Naming

Each filename uses the globally unique request_id.

This ensures:

* Duplicate prevention
* Safe retry
* Resume after failure
* Conflict resilience

The same request_id must be used in:

* Local IndexedDB
* Procurement record
* Storage path

---

## 26.6 Signed Upload Architecture

Direct client upload is not allowed.

Instead, the system uses a secure Cloudflare Worker.

Workflow:

1. Client authenticates via Supabase.
2. Client requests signed upload URL from Worker.
3. Worker validates JWT.
4. Worker generates signed R2 upload URL.
5. Client uploads directly to R2.
6. Client stores storage path in Supabase.

Benefits:

* Secure
* Scalable
* No backend bottleneck

---

## 26.7 Authentication and Validation

The Worker must:

* Validate Supabase JWT
* Extract organization_id
* Enforce folder prefix

The client cannot:

* Upload outside its tenant
* Override storage path

---

## 26.8 Storage Isolation Policy

Isolation is enforced by:

* JWT validation
* Folder prefix
* Signed URL expiration

The Worker must reject:

* Cross-tenant upload
* Invalid path

---

## 26.9 Download and Viewing

Images are accessed through:

* Signed download URLs
* Short expiry

Future:

* Edge caching
* Public CDN layer

---

## 26.10 Image Transformation and CDN

Cloudflare edge features enable:

* Thumbnail generation
* Resize on demand
* Format conversion

This reduces:

* Bandwidth
* Load time

---

## 26.11 Versioning and Derivatives

Future variants:

* original
* compressed
* thumbnail
* AI-processed

Stored under the same request_id.

---

## 26.12 Lifecycle Management

Future automation:

* Archive old images
* Cold storage
* Retention policies
* Compliance rules

---

## 26.13 Performance Targets

The storage layer must:

* Support batch upload
* Handle network instability
* Resume interrupted uploads
* Upload under 2 seconds per image

Strategies:

* Sequential upload
* Compression
* Retry logic

---

## 26.14 Observability and Monitoring

Track:

* Upload latency
* Failure rate
* Storage growth
* Duplicate attempts

Future:

* Alerting
* Cost monitoring

---

## 26.15 Cost Optimization

Key strategies:

* Aggressive compression
* Thumbnail-first viewing
* Archive unused assets
* AI dataset tiering

---

## 26.16 Security Best Practices

* Never expose raw bucket
* Use short-lived signed URLs
* Rotate keys
* Monitor abuse

---

## 26.17 Future Enhancements

* AI image classification
* Visual similarity search
* Demand signal extraction
* Automated supplier intelligence

---


# 27. Storage and Upload Performance

Targets:

* Upload under 2 seconds
* Stable under batch
* Resume-safe

Strategies:

* Compression pipeline
* Sequential upload
* Retry logic

---

# 28. Offline Sync Conflict Resolution – Hardened

This section defines the real-world conflict model.

---

## 28.1 Key Principles

1. Server is the source of truth
2. All operations idempotent
3. Ledger immutable
4. Retry until confirmed

---

## 28.2 Conflict Types

### Duplicate submission

Handled by unique request_id.

### Partial upload

Handled by uploadPointer.

### Network timeout

Safe retry.

### Multi-device model creation

Handled by unique normalized_name.

---

## 28.3 Sync Engine Workflow

For each queued item:

1. Check uploadPointer
2. Upload image if required
3. Insert procurement
4. If duplicate → treat as success
5. Delete local

---

## 28.4 Retry Strategy

Automatic retry triggered by:

* Network restored
* App opened

Priority:

1. Failed
2. Interrupted
3. Pending

Max retry:

5 attempts.

---

## 28.5 Multi-Device Consistency

Each device includes:

* device_id

Future:

* trust model
* anomaly detection

---

## 28.6 Background Sync

Future service worker:

* Silent sync
* Queue monitoring

---

## 28.7 Observability

Track:

* Retry rate
* Duplicate prevention
* Sync latency

---

# 29. Acceptance Criteria

The system is production-ready when:

* Strong tenant isolation
* No duplicate transactions
* Secure storage
* Reliable offline recovery

---

# 30. Audit Trail & Correction System

This section defines the auditability, traceability, and correction architecture for the procurement ledger. The goal is to preserve historical truth while allowing controlled operational correction.

---

## 30.1 Objectives

The correction and audit system must:

* Preserve immutable procurement history
* Prevent destructive edits
* Provide full traceability
* Support accountability and compliance
* Enable financial and analytical accuracy
* Support future fraud detection

---

## 30.2 Design Principles

### Immutable Core Ledger

Procurement records must never be overwritten or deleted in normal workflows. All changes must be recorded as adjustment events.

### Event-Based Correction

Every correction is stored as a new event rather than modifying original data.

### Full Traceability

Each correction must record:

* Who performed the change
* When the change occurred
* Why the change was made

### Separation of Responsibilities

Capture workflow and correction workflow must be separate.

---

## 30.3 Adjustment Table

Table: procurement_adjustments

Fields:

* id (uuid, PK)
* procurement_id (uuid, FK → procurement)
* organization_id (uuid)
* adjustment_type (text)

  * price
  * quantity
  * supplier
  * model
* old_value (jsonb)
* new_value (jsonb)
* reason (text, required)
* created_by (uuid, FK users)
* created_at (timestamp default now())

Indexes:

* organization_id
* procurement_id
* created_at

---

## 30.4 Correction Workflow

1. User opens procurement detail.
2. Select "Correct".
3. Choose correction type.
4. Provide reason.
5. System records adjustment.
6. Derived values are recalculated.

No base record modification occurs.

---

## 30.5 Derived and Analytical Views

All analytics and reporting must use a derived view that combines:

* procurement ledger
* adjustment events

Example:

* Latest effective price
* Corrected quantity

Materialized views may be used for performance.

---

## 30.6 Role and Permission Control

Correction permissions:

* Manager and Owner only

Optional future:

* Approval workflow

---

## 30.7 Audit Log System

All sensitive actions must be recorded in a general audit table.

Table: audit_logs

Fields:

* id
* organization_id
* user_id
* action
* entity
* entity_id
* metadata
* created_at

Tracked actions:

* Login
* Procurement capture
* Corrections
* Security events

---

## 30.8 Monitoring and Anomaly Detection

Metrics:

* Correction frequency
* Outlier pricing
* Suspicious activity

Future:

* Automated alerts

---

## 30.9 Fraud Prevention and Governance

Future enhancements:

* Price anomaly alerts
* Supplier fraud detection
* Risk scoring

---

## 30.10 Compliance and Reporting

Supports:

* Financial audit
* External reporting
* Tax readiness

---

## 30.11 Acceptance Criteria

The system is ready when:

* No destructive edits
* Full traceability
* Reliable analytical outputs

---

# 31. Procurement Viewing & Retrieval System

This section defines the architecture, user experience, and performance model for viewing procurement records. Retrieval and insight are critical for long-term value because the system must transform raw capture into actionable intelligence.

---

## 31.1 Objectives

The viewing system must:

* Provide fast access to recent transactions
* Enable powerful filtering and search
* Support mobile-first workflows
* Scale to millions of records
* Support offline fallback
* Prepare for analytics and AI

The design prioritizes real-world procurement behavior where users mostly check recent activity and occasionally search historical data.

---

## 31.2 Viewing Layers

The system is designed with three progressive layers.

### Layer 1: Recent Activity

This is the default landing view after login.

Purpose:

* Show the most recent procurement activity
* Enable quick validation after procurement
* Provide confidence that capture worked

Characteristics:

* Displays the latest 20–50 records
* Optimized for speed
* Mobile-friendly

---

### Layer 2: Search & Filter

Used to locate historical transactions.

Supports:

* Supplier filtering
* Model filtering
* Date range
* Staff
* Batch
* Price

This layer must be highly responsive and incremental.

---

### Layer 3: Insight and Trends (Future)

Transforms procurement into decision-making.

Includes:

* Supplier price comparison
* Model price trends
* Volume insights

---

## 31.3 User Experience Design

### 31.3.1 Recent Activity Feed

Each row must include:

* Thumbnail image
* Model name
* Supplier
* Price
* Timestamp

Interaction:

* Tap → open detail
* Swipe → quick actions (future)

---

### 31.3.2 Detail Screen

The detail screen must show:

* Large image
* Supplier information
* Model metadata
* Price
* Capture time
* Staff

Future enhancements:

* Price history
* Supplier comparison
* Correction entry

---

## 31.4 Data Retrieval Architecture

The frontend must retrieve data using optimized relational queries.

Key design:

* Fetch procurement with supplier and model join
* Fetch thumbnail only
* Lazy load details

---

## 31.5 Query Model

The primary query pattern:

* Order by captured_at descending
* Limit results
* Paginated

All queries must include tenant filtering through RLS.

---

## 31.6 Pagination Strategy

The system must avoid large result sets.

Supported strategies:

* Offset pagination
* Cursor-based pagination (future)

Recommended:

Cursor-based pagination for large datasets.

---

## 31.7 Performance Requirements

Targets:

* First load under 1 second
* Smooth scrolling
* Stable under large datasets

Key optimizations:

* Indexing
* Thumbnail delivery
* Incremental loading

---

## 31.8 Caching and Offline Viewing

The system must cache recent transactions locally.

Strategy:

* Store last 50–100 records in IndexedDB
* Load local first
* Sync in background

Benefits:

* Fast startup
* Offline visibility
* Reduced network dependency

---

## 31.9 Image Optimization

Images must be:

* Served as thumbnails
* Lazy-loaded
* Cached

Future:

* CDN transformation

---

## 31.10 Search System

Search must support:

* Fast model lookup
* Fuzzy matching
* Partial match

Future database enhancements:

* Trigram indexing
* Full-text search

---

## 31.11 Filter System

Filters must be composable.

Examples:

* Supplier + date
* Model + price

Filters must be stateful and shareable.

---

## 31.12 Advanced Retrieval

Future support:

* Saved filters
* Favorites
* Alerts

---

## 31.13 Business Intelligence Integration

The viewing layer must feed analytics.

Data pipeline:

* Procurement → warehouse → dashboard

---

## 31.14 Real-Time Updates (Future)

Support:

* Live feed
* Sync across devices

---

## 31.15 Monitoring

Track:

* Query latency
* Load time
* User behavior

---

## 31.16 Security

The viewing layer must:

* Respect RLS
* Prevent data leaks

---

## 31.17 Acceptance Criteria

The system is considered complete when:

* Recent data loads instantly
* Historical search is reliable
* Offline viewing works
* Performance remains stable

---

# 32. SQL Schema and RLS Policies

This section defines production-ready SQL schema, constraints, and Row Level Security policies for the **procurement_adjustments** and **audit_logs** tables.

These tables are critical for traceability, governance, and compliance.

---

## 32.1 Procurement Adjustments – SQL Schema

This table stores immutable correction events.

```sql
create table public.procurement_adjustments (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null references public.organizations(id) on delete cascade,

  procurement_id uuid not null references public.procurement(id) on delete cascade,

  adjustment_type text not null,

  old_value jsonb,
  new_value jsonb not null,

  reason text not null,

  created_by uuid not null references public.users(id),

  created_at timestamptz not null default now()
);
```

---

## 32.2 Constraints and Validation

```sql
alter table public.procurement_adjustments
add constraint valid_adjustment_type
check (adjustment_type in ('price','quantity','supplier','model'));
```

Optional future extension:

* discount
* tax
* metadata

---

## 32.3 Index Strategy

Indexes ensure performance for viewing and analytics.

```sql
create index idx_adj_org on public.procurement_adjustments (organization_id);
create index idx_adj_proc on public.procurement_adjustments (procurement_id);
create index idx_adj_created on public.procurement_adjustments (created_at desc);
```

---

## 32.4 Derived Analytics Example

Example view to compute latest price:

```sql
create view public.procurement_effective as
select
  p.*,
  coalesce(
    (
      select (new_value->>'price')::numeric
      from public.procurement_adjustments a
      where a.procurement_id = p.id
      and a.adjustment_type = 'price'
      order by a.created_at desc
      limit 1
    ),
    p.price
  ) as effective_price
from public.procurement p;
```

This preserves original history while enabling corrected analytics.

---

## 32.5 RLS – Procurement Adjustments

Enable RLS:

```sql
alter table public.procurement_adjustments enable row level security;
```

---

### 32.5.1 Select Policy

Users can read only their organization.

```sql
create policy "select own adjustments"
on public.procurement_adjustments
for select
using (
  organization_id = (auth.jwt() ->> 'organization_id')::uuid
);
```

---

### 32.5.2 Insert Policy

Only manager and owner roles.

```sql
create policy "insert adjustments"
on public.procurement_adjustments
for insert
with check (
  organization_id = (auth.jwt() ->> 'organization_id')::uuid
  and (auth.jwt() ->> 'role') in ('manager','owner')
);
```

---

### 32.5.3 Update and Delete

Disabled to preserve immutability.

---

## 32.6 Audit Logs – SQL Schema

This table tracks all sensitive system events.

```sql
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null references public.organizations(id) on delete cascade,

  user_id uuid references public.users(id),

  action text not null,
  entity text,
  entity_id uuid,

  metadata jsonb,

  created_at timestamptz not null default now()
);
```

---

## 32.7 Audit Log Indexing

```sql
create index idx_audit_org on public.audit_logs (organization_id);
create index idx_audit_user on public.audit_logs (user_id);
create index idx_audit_time on public.audit_logs (created_at desc);
```

---

## 32.8 RLS – Audit Logs

Enable RLS:

```sql
alter table public.audit_logs enable row level security;
```

---

### 32.8.1 Select Policy

```sql
create policy "select audit own org"
on public.audit_logs
for select
using (
  organization_id = (auth.jwt() ->> 'organization_id')::uuid
);
```

---

### 32.8.2 Insert Policy

Audit logs should normally be inserted by backend or edge functions.

```sql
create policy "insert audit"
on public.audit_logs
for insert
with check (
  organization_id = (auth.jwt() ->> 'organization_id')::uuid
);
```

Optional hardening:

* Restrict inserts to service role only.

---

## 32.9 Best Practices

* Never allow updates or deletes in audit logs.
* Use backend automation for sensitive logging.
* Log all correction workflows.
* Log authentication and permission changes.

---

## 32.10 Future Enhancements

* Device fingerprint logging
* Risk scoring
* Suspicious pattern detection
* Automated compliance reports

---


# 33. Cloudflare Worker – JWT Validation and Signed URL Service

This section defines the architecture and security model for the Cloudflare Worker that manages authentication, authorization, and signed URL generation for Cloudflare R2.

The Worker acts as a secure gateway between the frontend and storage.

---

## 33.1 Objectives

The Worker must:

* Validate Supabase JWT
* Enforce tenant isolation
* Generate secure signed upload URLs
* Generate signed download URLs
* Prevent unauthorized access
* Support offline batch and retry
* Scale globally

---

## 33.2 High-Level Architecture

```
Client → Cloudflare Worker → Cloudflare R2
              ↑
         Supabase Auth
```

The Worker never stores sensitive credentials in the client.

---

## 33.3 Authentication Flow

1. User logs in via Supabase Auth.
2. Client receives access token (JWT).
3. Client calls Worker with Authorization header.
4. Worker verifies token.
5. Worker extracts claims.
6. Worker generates signed URL.

---

## 33.4 JWT Validation

The Worker must validate:

* Signature
* Expiry
* Issuer
* Audience

Using Supabase JWKS endpoint.

Example:

```
https://PROJECT.supabase.co/auth/v1/keys
```

Required claims:

* sub
* organization_id
* role

Reject requests if:

* Token invalid
* Token expired
* Organization missing

---

## 33.5 Authorization Rules

The Worker must:

* Restrict storage access by organization
* Enforce role-based restrictions

Example:

* Staff: upload only
* Manager: upload + read
* Owner: full access

---

## 33.6 Signed Upload URL Workflow

Step-by-step:

1. Client requests upload URL with:

   * file metadata
   * supplier
   * request_id

2. Worker validates:

   * JWT
   * organization
   * input format

3. Worker constructs path:

```
organization_id/supplier_id/year/month/request_id.jpg
```

4. Worker generates presigned PUT URL.

5. Worker returns:

* upload_url
* storage_path

---

## 33.7 Signed Download URL

For viewing images:

1. Client requests download URL.
2. Worker validates ownership.
3. Worker generates short-lived signed URL.

Expiration:

* 5–15 minutes.

---

## 33.8 Security Controls

The Worker must prevent:

* Path manipulation
* Cross-tenant access
* Oversized uploads
* Unauthorized reads

Validation:

* File size limits
* Content type
* Allowed extensions

---

## 33.9 Rate Limiting and Abuse Protection

Use Cloudflare features:

* Rate limits
* Bot detection
* WAF rules

Detect:

* Repeated invalid JWT
* Excess upload attempts

---

## 33.10 Logging and Observability

The Worker must log:

* Upload requests
* Failures
* Security violations

Logs may be sent to:

* Supabase
* Cloudflare analytics

---

## 33.11 Error Handling

Errors must be:

* Structured
* Predictable

Examples:

* Unauthorized
* Expired token
* Invalid path

---

## 33.12 Performance Targets

The Worker must:

* Respond under 100 ms
* Support high concurrency
* Handle batch sessions

---

## 33.13 Offline Batch Support

The Worker must support:

* Resume upload
* Duplicate safe upload

The same request_id must always generate the same storage path.

---

## 33.14 Future Enhancements

* Image virus scanning
* AI preprocessing
* Watermarking
* Metadata extraction

---

End of Specification.
