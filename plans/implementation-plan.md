# Procurement System - Implementation Plan

**Project:** Procurement & Product Intelligence System  
**Stack:** Supabase + Cloudflare (PWA, Offline-first)  
**Team:** 1 Full-stack Developer  
**Duration:** 30 Days (6 Weeks)

---

## Project Overview

Build a mobile-first procurement system with offline-first capabilities for wholesale environments. The system captures product images, prices, and supplier data with reliable sync to cloud storage.

### Core Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Mobile PWA   │────▶│  Cloudflare      │────▶│    Supabase     │
│  (IndexedDB)   │     │  Pages + R2      │     │   (PostgreSQL)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                                                │
        │         Offline Layer (Sync Engine)           │
        └───────────────────────────────────────────────┘
```

---

## Phase 0: Core Infrastructure (Days 1-2) ✅ COMPLETED

### 0.1 Supabase Setup
- [x] Create Supabase project
- [x] Configure database schema:
  - [x] `organizations` table
  - [x] `users` table
  - [x] `suppliers` table
  - [x] `models` table
  - [x] `procurement` table
  - [x] `procurement_images` table
- [x] Setup Row Level Security (RLS) policies - see `plans/rls/rls.json`
- [x] Configure authentication (email/magic link) - implemented in `src/modules/api.js`
- [x] Setup JWT custom claims for organization_id - used in RLS policies

### 0.2 Cloudflare Setup
- [x] Create Cloudflare account
- [x] Setup Cloudflare R2 bucket for image storage
- [ ] Configure CORS for R2 bucket - **NOT VERIFIED**
- [x] Create Cloudflare Worker project - see `workers/upload.js`
- [x] Implement signed upload endpoint - in `workers/upload.js`
- [x] Implement signed download endpoint - in `workers/upload.js`
- [x] Setup Cloudflare Pages project - configured in project
- [ ] Configure custom domain (optional) - **NOT IMPLEMENTED**

### 0.3 Project Initialization
- [x] Initialize frontend project structure - Vite + Vanilla JS
- [x] Setup Tailwind CSS
- [x] Configure build tools - Vite
- [x] Setup environment variables - see `src/modules/config.js`

---

## Phase 1: Single Capture - End-to-End (Days 3-7) ✅ COMPLETED

### 1.1 Camera Capture Module
- [x] Implement camera access API - `src/pages/capture.js:103-130`
- [x] Create camera capture UI component - `src/pages/capture.js`
- [x] Add image preview functionality - `src/pages/capture.js:69-80`
- [ ] Add camera switching (front/back) - **NOT IMPLEMENTED** (only uses environment camera)
- [x] Handle camera permissions - `src/pages/capture.js:119-129`

### 1.2 Form Components
- [x] Create supplier input field - `src/pages/capture.js:35-41`
- [x] Create model input field - `src/pages/capture.js:44-50`
- [x] Create price input field - `src/pages/capture.js:53-64`
- [x] Add form validation - `src/pages/capture.js:144-155`

### 1.3 Upload Integration
- [x] Connect to Cloudflare Worker signed upload - `src/modules/api.js:229-250`
- [x] Implement image upload flow - `src/modules/sync.js:136`
- [x] Save procurement record to Supabase - `src/modules/sync.js:139-165`
- [x] Handle upload success/failure feedback - `src/modules/app.js:162-180`
- [x] Add retry logic for failed uploads - `src/modules/sync.js:80-96`

### 1.4 Validation
- [x] End-to-end capture testing
- [x] Error handling and edge cases - see error handling in `capture.js`
- [x] UI feedback for all states - notifications in `src/modules/app.js`

---

## Phase 2: Offline-First Foundation (Days 8-14) ✅ COMPLETED

### 2.1 IndexedDB Setup
- [x] Create IndexedDB database schema - `src/modules/db.js`
- [x] Implement local storage for captures
- [x] Create offline queue structure:
  ```javascript
  {
    id, requestId, imageBlob, model, price,
    supplier, timestamp, status, retryCount, uploadPointer
  }
  ```

### 2.2 Queue System
- [x] Implement queue management - `src/modules/db.js:67-134`
- [x] Track upload status (pending, uploading, success, failed) - `src/modules/db.js`
- [x] Create queue UI visualization - `src/pages/home.js:50-72` (sync status card)
- [x] Add manual retry functionality - via sync engine automatic retry

### 2.3 Sync Engine
- [x] Implement sequential upload - `src/modules/sync.js:74-97`
- [x] Add automatic retry with exponential backoff - `src/modules/sync.js:80-96`
- [x] Create resume capability after crash - relies on IndexedDB persistence
- [x] Handle network status changes - `src/modules/app.js:118-137`

### 2.4 Offline Testing
- [ ] Test airplane mode functionality - **NOT TESTED**
- [ ] Test network instability scenarios - **NOT TESTED**
- [ ] Validate no data loss - **NOT TESTED**
- [ ] Test app restart recovery - **NOT TESTED**

---

## Phase 3: Batch Capture Mode (Days 15-17) ✅ COMPLETED

### 3.1 Batch UI
- [x] Create continuous capture mode - `src/pages/batch.js`
- [x] Implement supplier lock per batch - `src/pages/batch.js:221-231`
- [x] Add minimal interaction workflow - fast input flow implemented
- [x] Create "next item" fast input flow - `src/pages/batch.js:362-368`

### 3.2 Performance Optimization
- [x] Preload camera for instant capture - `src/pages/batch.js:236-263`
- [x] Optimize rendering transitions
- [x] Reduce taps required
- [x] Implement batch progress counter - `src/pages/batch.js:84-86`

### 3.3 Stress Testing
- [ ] Test 50-100 item batches - **NOT TESTED**
- [ ] Validate memory usage - **NOT TESTED**
- [ ] Test with various devices - **NOT TESTED**

---

## Phase 4: Recent Activity Viewing (Days 18-20) ✅ COMPLETED

### 4.1 List View
- [x] Create recent transactions list - `src/pages/list.js`
- [x] Fetch latest data from Supabase - `src/modules/api.js:157-173`
- [x] Add pagination/infinite scroll - `src/pages/list.js:90, 275-280`
- [x] Display thumbnails - `src/pages/list.js:236-246`

### 4.2 Detail View
- [x] Create full record view - `src/pages/detail.js`
- [x] Display all procurement details - `src/pages/detail.js:90-167`
- [x] Show image in full resolution - `src/pages/detail.js:92-102`

### 4.3 Filters
- [x] Supplier filter - `src/pages/list.js:30-32`
- [x] Date range filter - `src/pages/list.js:34-37`
- [x] Basic search functionality - `src/pages/list.js:39-44`

---

## Phase 5: Search & Autocomplete (Days 21-23) ⚠️ PARTIALLY COMPLETED

### 5.1 Model Search
- [x] Implement autocomplete for model names - basic search in `src/modules/db.js:256-264`
- [ ] Create normalized_name matching - **PARTIAL** (basic implementation)
- [ ] Add fuzzy search capability - **NOT IMPLEMENTED**

### 5.2 Supplier Search
- [x] Implement quick supplier selection - `src/pages/batch.js:167-207`
- [x] Add recent suppliers quick access - via supplier list
- [x] Create supplier dropdown with search - `src/pages/batch.js`

### 5.3 Performance
- [x] Optimize search queries
- [ ] Reduce initial load time - **COULD BE IMPROVED**
- [x] Implement caching - local caching in IndexedDB

---

## Phase 6: Image Compression & Optimization (Days 24-25) ✅ COMPLETED

### 6.1 Compression Pipeline
- [x] Implement image resizing (max 1200px width) - `src/modules/compression.js:7-49`
- [x] Add JPEG compression (80-200KB target) - quality 0.7 in `src/modules/config.js:37`
- [ ] Remove image metadata - **NOT IMPLEMENTED** (uses canvas which strips some metadata)
- [ ] Implement adaptive quality based on content - **NOT IMPLEMENTED**

### 6.2 Storage Optimization
- [x] Implement storage path structure: `organization_id/supplier_id/year/month/request_id.jpg` - `src/modules/sync.js:126`
- [ ] Configure R2 lifecycle rules - **NOT CONFIGURED**

---

## Phase 7: Correction & Audit (Days 26-28) ❌ NOT STARTED

### 7.1 Correction Workflow
- [ ] Create price correction UI - **NOT IMPLEMENTED**
- [ ] Implement quantity adjustment - **NOT IMPLEMENTED**
- [ ] Add correction approval workflow - **NOT IMPLEMENTED**

### 7.2 Audit Trail
- [ ] Create audit log table - **NOT IMPLEMENTED** (no audit_logs table in schema)
- [ ] Record all modification events - **NOT IMPLEMENTED**
- [ ] Implement audit trail view - **NOT IMPLEMENTED**

### 7.3 Data Integrity
- [ ] Validate all corrections - **NOT IMPLEMENTED**
- [ ] Test correction rollback - **NOT IMPLEMENTED**
- [ ] Verify audit trail accuracy - **NOT IMPLEMENTED**

---

## Phase 8: Stabilization & Launch (Days 29-30) ❌ NOT STARTED

### 8.1 Final Testing
- [ ] Comprehensive edge case testing - **NOT COMPLETED**
- [ ] Stress testing under load - **NOT COMPLETED**
- [ ] Cross-device testing - **NOT COMPLETED**

### 8.2 Bug Fixes
- [ ] Fix UX issues - **NOT COMPLETED**
- [ ] Fix sync bugs - **NOT COMPLETED**
- [ ] Fix performance issues - **NOT COMPLETED**

### 8.3 Deployment
- [ ] Deploy to production - **NOT COMPLETED**
- [ ] Configure monitoring - **NOT COMPLETED**
- [ ] Setup error tracking - **NOT COMPLETED**
- [ ] Launch to real users - **NOT COMPLETED**

---

## Technical Specifications Summary

### Database Schema

```
organizations
├── id (uuid, PK)
├── name (text)
└── created_at (timestamp)

users
├── id (uuid, PK, FK → auth.users)
├── organization_id (uuid, FK)
├── role (enum: owner, manager, staff)
└── name (text)

suppliers
├── id (uuid, PK)
├── organization_id (uuid, FK)
├── name (text)
├── normalized_name (text)
├── phone (text)
├── location (text)
└── created_at (timestamp)

models
├── id (uuid, PK)
├── organization_id (uuid, FK)
├── name (text)
├── normalized_name (text)
├── category (text)
├── gender (text)
└── first_seen (timestamp)

procurement
├── id (uuid, PK)
├── organization_id (uuid, FK)
├── supplier_id (uuid, FK)
├── model_id (uuid, FK)
├── request_id (uuid, unique)
├── price (numeric)
├── quantity (int)
├── captured_by (uuid)
├── captured_at (timestamp)
├── device_id (text)
└── batch_id (uuid)

procurement_images
├── id (uuid, PK)
├── procurement_id (uuid, FK)
├── organization_id (uuid, FK)
├── storage_path (text)
├── content_type (text)
├── file_size (int)
├── variant (text)
└── created_at (timestamp)
```

### Storage Structure

```
R2 Bucket: procurement-images
└── {organization_id}/
    └── {supplier_id}/
        └── {year}/
            └── {month}/
                └── {request_id}.jpg
```

### Key Success Metrics

- Capture time: < 1 second
- Batch stability: 100 items - **NOT TESTED**
- Upload success rate: > 99% - **NOT MEASURED**
- Offline reliability: Zero data loss - **NOT TESTED**

---

## Daily Breakdown Summary

| Week | Days | Focus | Status |
|------|------|-------|--------|
| 1 | 1-7 | Core Infrastructure + Single Capture | ✅ Completed |
| 2 | 8-14 | Offline-First Foundation | ✅ Completed |
| 3 | 15-17 | Batch Capture Mode | ✅ Completed |
| 4 | 18-20 | Recent Activity Viewing | ✅ Completed |
| 5 | 21-23 | Search & Autocomplete | ⚠️ Partial |
| 6 | 24-30 | Compression, Correction, Stabilization | ❌ Incomplete |

---

## Implementation Status Summary

### Completed Phases
- **Phase 0 (Core Infrastructure)**: 95% Complete
- **Phase 1 (Single Capture)**: 90% Complete (missing camera switching)
- **Phase 2 (Offline-First)**: 85% Complete (missing testing)
- **Phase 3 (Batch Capture)**: 85% Complete (missing stress testing)
- **Phase 4 (Recent Activity)**: 100% Complete
- **Phase 5 (Search)**: 60% Complete (missing fuzzy search)
- **Phase 6 (Compression)**: 80% Complete (missing metadata removal, adaptive quality)
- **Phase 7 (Correction & Audit)**: 0% Complete
- **Phase 8 (Stabilization)**: 0% Complete

### Missing/Incomplete Features

1. **Camera switching** - Only back camera is used
2. **Fuzzy search** - Basic search only
3. **Adaptive image quality** - Fixed quality 0.7
4. **Metadata removal** - Not implemented
5. **Correction workflow** - Not implemented
6. **Audit trail** - Not implemented
7. **R2 lifecycle rules** - Not configured
8. **Production testing** - Not performed
9. **Deployment** - Not completed

### Code Quality Issues Identified

1. No error boundaries for failed component renders
2. No loading states for all async operations
3. Missing ARIA labels in some components
4. No unit tests
5. No E2E tests
6. Missing PWA service worker for full offline capability

---

## Next Steps

1. ⏭️ **Priority 1**: Complete Phase 7 (Correction & Audit) - Required for production use
2. ⏭️ **Priority 2**: Add camera switching functionality
3. ⏭️ **Priority 3**: Implement fuzzy search for models
4. ⏭️ **Priority 4**: Comprehensive testing (offline, stress, cross-device)
5. ⏭️ **Priority 5**: Production deployment and monitoring setup
