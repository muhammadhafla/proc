# Procurement System – Feature Priority Roadmap

This document defines the **development priorities and execution sequence** for building a production-ready procurement system. The goal is to launch quickly while maintaining long-term scalability and architectural integrity.

The focus is strictly on **procurement only** in the initial phase. Other modules such as inventory, POS, analytics, and AI will be introduced later.

---

# 1. Strategic Goal

The primary goal is to deliver a system that:

* Works reliably in real-world wholesale environments
* Supports unstable or offline network conditions
* Enables fast product capture
* Prevents data loss
* Builds user trust
* Can scale without major rewrite

The system should prioritize:

* Stability over features
* Speed over perfection
* Reliability over complexity

---

# 2. Scope (Current Phase)

## 2.1 Included

This phase focuses only on:

* Procurement capture
* Offline batch
* Viewing
* Correction
* Security
* Cloud storage

## 2.2 Excluded (Future)

The following modules are explicitly out of scope for now:

* Inventory
* POS
* Analytics
* AI
* Event-driven automation
* Multi-branch workflow
* Approval chains

These will be added later using the existing architecture.

---

# 3. Development Phases

The roadmap is designed for fast deployment with measurable progress.

---

## Phase 0 – Core Infrastructure

Estimated duration: 1–2 days

### Objectives

Establish the minimal working cloud environment.

### Deliverables

* Supabase project setup
* Authentication (basic login)
* Core procurement database tables
* Cloudflare R2 setup
* Cloudflare Worker for signed upload
* Cloudflare Pages frontend deployment

### Acceptance Criteria

* User can log in
* Environment is connected end-to-end

---

## Phase 1 – Single Capture (End-to-End)

Estimated duration: Week 1

### Objectives

Validate the full pipeline from capture to cloud storage.

### Features

* Camera capture
* Image preview
* Supplier input
* Model input
* Price input
* Upload image to R2 via signed URL
* Save procurement record in Supabase
* Confirmation feedback

### Key Success Metric

* Stable capture in real conditions

### Risks

* Image upload failures
* Latency

---

## Phase 2 – Offline First Foundation

Estimated duration: Week 2–3

### Objectives

Ensure the system is reliable in unstable network conditions.

### Features

* IndexedDB local storage
* Queue system
* Retry mechanism
* Resume after crash
* Sequential sync

### Key Success Metric

* No data loss

### Risks

* Duplicate submission
* Partial uploads

---

## Phase 3 – Batch Capture Mode

Estimated duration: Week 3

### Objectives

Enable high-speed procurement in wholesale environments.

### Features

* Continuous capture mode
* Minimal interaction
* Supplier locked per batch
* Fast input
* Next item workflow

### Key Success Metric

* Fast user workflow

---

## Phase 4 – Recent Activity Viewing

Estimated duration: Week 4

### Objectives

Allow users to verify procurement activity.

### Features

* Recent transaction list
* Thumbnail
* Supplier
* Model
* Price
* Timestamp

### Key Success Metric

* High user trust

---

## Phase 5 – Detail View and Basic Search

Estimated duration: Week 4–5

### Objectives

Allow retrieval of historical records.

### Features

* Detail view
* Supplier filter
* Model filter
* Date range
* Basic search

---

## Phase 6 – Image Compression Optimization

Estimated duration: Week 5

### Objectives

Reduce storage and bandwidth costs.

### Features

* Resize
* JPEG compression
* Adaptive quality

### Target

* 80–200 KB per image

---

## Phase 7 – Minimal Correction and Audit

Estimated duration: Week 6

### Objectives

Support operational correction without modifying history.

### Features

* Price correction
* Adjustment logging
* Audit trail

---

## Phase 8 – Stabilization and Field Testing

Estimated duration: Week 6+

### Objectives

Ensure reliability in real procurement environments.

### Focus Areas

* Low signal environments
* Battery saver behavior
* Mobile memory limits
* App crash recovery
* Stress testing

---

# 4. Critical Success Factors

## 4.1 Stability

The system must:

* Never lose procurement data

## 4.2 Speed

Capture must be fast and frictionless.

## 4.3 Reliability

Users must trust the system.

---

# 5. Testing Strategy

## 5.1 Field Testing

Test in real markets with:

* Poor internet
* High capture volume

## 5.2 Stress Testing

Simulate:

* 100+ items
* Interruptions

---

# 6. Deployment Strategy

* Launch internally first
* Collect real feedback
* Iterate

---

# 7. Future Expansion Path

After stabilization, the next modules will be introduced:

1. Inventory
2. Supplier intelligence
3. POS
4. Analytics
5. AI forecasting

This phased approach ensures:

* Fast ROI
* Reduced risk
* Sustainable scaling

---

# 8. Daily Sprint Breakdown (Day-by-Day Execution)

This section provides a practical execution guide to help the development team deliver the procurement system quickly. The focus is speed, stability, and validation in real environments.

This assumes a small team (1–3 developers).

---

## Week 1 – Core Pipeline and Single Capture

### Day 1 – Environment Setup

Tasks:

* Create Supabase project
* Setup database tables (procurement, suppliers, models minimal)
* Setup authentication (email or magic link)
* Create Cloudflare account
* Setup Cloudflare Pages

Output:

* Working login
* Cloud project initialized

---

### Day 2 – Cloudflare R2 and Worker

Tasks:

* Create R2 bucket
* Setup Worker project
* Configure JWT verification with Supabase
* Implement signed upload endpoint

Output:

* Client can request signed URL

---

### Day 3 – Frontend Camera Capture

Tasks:

* Build camera capture UI
* Image preview
* Basic form (supplier, model, price)

Output:

* User can capture image locally

---

### Day 4 – Upload Integration

Tasks:

* Connect frontend to Worker
* Upload image to R2
* Save metadata to Supabase

Output:

* End-to-end capture working

---

### Day 5 – Stability and Validation

Tasks:

* Handle upload failure
* Retry logic basic
* UI feedback

Output:

* Stable single capture

---

## Week 2 – Offline and Local Queue

### Day 6 – IndexedDB Setup

Tasks:

* Create local storage schema
* Save capture locally

Output:

* Offline capture possible

---

### Day 7 – Queue System

Tasks:

* Implement queue
* Track upload status

Output:

* Pending items visible

---

### Day 8 – Sync Engine

Tasks:

* Upload sequentially
* Mark success

Output:

* Background sync works

---

### Day 9 – Resume and Crash Handling

Tasks:

* Resume after refresh
* Recover incomplete upload

Output:

* No data loss

---

### Day 10 – Offline Testing

Tasks:

* Airplane mode testing
* Network instability simulation

Output:

* Offline reliability validated

---

## Week 3 – Batch Capture

### Day 11 – Batch Mode

Tasks:

* Continuous capture UI
* Lock supplier

Output:

* Fast workflow

---

### Day 12 – UX Optimization

Tasks:

* Reduce taps
* Faster transitions

Output:

* Smooth batch

---

### Day 13 – Performance

Tasks:

* Preload camera
* Optimize rendering

Output:

* Minimal latency

---

### Day 14 – Real Field Simulation

Tasks:

* Simulate 50–100 captures

Output:

* Stress validated

---

### Day 15 – Bug Fixing

Tasks:

* Fix UX and sync bugs

---

## Week 4 – Viewing

### Day 16 – Recent Activity

Tasks:

* Fetch latest data
* List view

---

### Day 17 – Thumbnail

Tasks:

* Display image preview

---

### Day 18 – Pagination

Tasks:

* Infinite scroll

---

### Day 19 – Detail View

Tasks:

* Full record

---

### Day 20 – Filter

Tasks:

* Supplier and date

---

## Week 5 – Compression and Search

### Day 21 – Compression

Tasks:

* Resize
* Adaptive JPEG

---

### Day 22 – Performance

Tasks:

* Measure image size

---

### Day 23 – Model Search

Tasks:

* Autocomplete

---

### Day 24 – Supplier Search

Tasks:

* Quick selection

---

### Day 25 – Optimization

Tasks:

* Reduce load

---

## Week 6 – Correction and Stabilization

### Day 26 – Correction UI

Tasks:

* Edit price workflow

---

### Day 27 – Adjustment Logging

Tasks:

* Save to database

---

### Day 28 – Audit Logging

Tasks:

* Record events

---

### Day 29 – Final Testing

Tasks:

* Stress
* Edge cases

---

### Day 30 – Soft Launch

Tasks:

* Deploy
* Real usage

---

# 9. Expected Outcome

After 30 days:

* Production-ready procurement
* Stable offline-first
* Real market validated

---

End of Document.
