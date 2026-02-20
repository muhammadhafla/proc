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

## Phase 0: Core Infrastructure (Days 1-2)

### 0.1 Supabase Setup
- [ ] Create Supabase project
- [ ] Configure database schema:
  - [ ] `organizations` table
  - [ ] `users` table
  - [ ] `suppliers` table
  - [ ] `models` table
  - [ ] `procurement` table
  - [ ] `procurement_images` table
- [ ] Setup Row Level Security (RLS) policies
- [ ] Configure authentication (email/magic link)
- [ ] Setup JWT custom claims for organization_id

### 0.2 Cloudflare Setup
- [ ] Create Cloudflare account
- [ ] Setup Cloudflare R2 bucket for image storage
- [ ] Configure CORS for R2 bucket
- [ ] Create Cloudflare Worker project
- [ ] Implement signed upload endpoint
- [ ] Implement signed download endpoint
- [ ] Setup Cloudflare Pages project
- [ ] Configure custom domain (optional)

### 0.3 Project Initialization
- [ ] Initialize frontend project structure
- [ ] Setup Tailwind CSS
- [ ] Configure build tools
- [ ] Setup environment variables

---

## Phase 1: Single Capture - End-to-End (Days 3-7)

### 1.1 Camera Capture Module
- [ ] Implement camera access API
- [ ] Create camera capture UI component
- [ ] Add image preview functionality
- [ ] Implement camera switching (front/back)
- [ ] Handle camera permissions

### 1.2 Form Components
- [ ] Create supplier input field
- [ ] Create model input field
- [ ] Create price input field
- [ ] Add form validation

### 1.3 Upload Integration
- [ ] Connect to Cloudflare Worker signed upload
- [ ] Implement image upload flow
- [ ] Save procurement record to Supabase
- [ ] Handle upload success/failure feedback
- [ ] Add retry logic for failed uploads

### 1.4 Validation
- [ ] End-to-end capture testing
- [ ] Error handling and edge cases
- [ ] UI feedback for all states

---

## Phase 2: Offline-First Foundation (Days 8-14)

### 2.1 IndexedDB Setup
- [ ] Create IndexedDB database schema
- [ ] Implement local storage for captures
- [ ] Create offline queue structure:
  ```javascript
  {
    id, requestId, imageBlob, model, price,
    supplier, timestamp, status, retryCount, uploadPointer
  }
  ```

### 2.2 Queue System
- [ ] Implement queue management
- [ ] Track upload status (pending, uploading, success, failed)
- [ ] Create queue UI visualization
- [ ] Add manual retry functionality

### 2.3 Sync Engine
- [ ] Implement sequential upload
- [ ] Add automatic retry with exponential backoff
- [ ] Create resume capability after crash
- [ ] Handle network status changes

### 2.4 Offline Testing
- [ ] Test airplane mode functionality
- [ ] Test network instability scenarios
- [ ] Validate no data loss
- [ ] Test app restart recovery

---

## Phase 3: Batch Capture Mode (Days 15-17)

### 3.1 Batch UI
- [ ] Create continuous capture mode
- [ ] Implement supplier lock per batch
- [ ] Add minimal interaction workflow
- [ ] Create "next item" fast input flow

### 3.2 Performance Optimization
- [ ] Preload camera for instant capture
- [ ] Optimize rendering transitions
- [ ] Reduce taps required
- [ ] Implement batch progress indicator

### 3.3 Stress Testing
- [ ] Test 50-100 item batches
- [ ] Validate memory usage
- [ ] Test with various devices

---

## Phase 4: Recent Activity Viewing (Days 18-20)

### 4.1 List View
- [ ] Create recent transactions list
- [ ] Fetch latest data from Supabase
- [ ] Add pagination/infinite scroll
- [ ] Display thumbnails

### 4.2 Detail View
- [ ] Create full record view
- [ ] Display all procurement details
- [ ] Show image in full resolution

### 4.3 Filters
- [ ] Supplier filter
- [ ] Date range filter
- [ ] Basic search functionality

---

## Phase 5: Search & Autocomplete (Days 21-23)

### 5.1 Model Search
- [ ] Implement autocomplete for model names
- [ ] Create normalized_name matching
- [ ] Add fuzzy search capability

### 5.2 Supplier Search
- [ ] Implement quick supplier selection
- [ ] Add recent suppliers quick access
- [ ] Create supplier dropdown with search

### 5.3 Performance
- [ ] Optimize search queries
- [ ] Reduce initial load time
- [ ] Implement caching

---

## Phase 6: Image Compression & Optimization (Days 24-25)

### 6.1 Compression Pipeline
- [ ] Implement image resizing (max 1200px width)
- [ ] Add JPEG compression (80-200KB target)
- [ ] Remove image metadata
- [ ] Implement adaptive quality based on content

### 6.2 Storage Optimization
- [ ] Implement storage path structure: `organization_id/supplier_id/year/month/request_id.jpg`
- [ ] Configure R2 lifecycle rules

---

## Phase 7: Correction & Audit (Days 26-28)

### 7.1 Correction Workflow
- [ ] Create price correction UI
- [ ] Implement quantity adjustment
- [ ] Add correction approval workflow

### 7.2 Audit Trail
- [ ] Create audit log table
- [ ] Record all modification events
- [ ] Implement audit trail view

### 7.3 Data Integrity
- [ ] Validate all corrections
- [ ] Test correction rollback
- [ ] Verify audit trail accuracy

---

## Phase 8: Stabilization & Launch (Days 29-30)

### 8.1 Final Testing
- [ ] Comprehensive edge case testing
- [ ] Stress testing under load
- [ ] Cross-device testing

### 8.2 Bug Fixes
- [ ] Fix UX issues
- [ ] Fix sync bugs
- [ ] Fix performance issues

### 8.3 Deployment
- [ ] Deploy to production
- [ ] Configure monitoring
- [ ] Setup error tracking
- [ ] Launch to real users

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
- Batch stability: 100 items
- Upload success rate: > 99%
- Offline reliability: Zero data loss

---

## Daily Breakdown Summary

| Week | Days | Focus |
|------|------|-------|
| 1 | 1-7 | Core Infrastructure + Single Capture |
| 2 | 8-14 | Offline-First Foundation |
| 3 | 15-17 | Batch Capture Mode |
| 4 | 18-20 | Recent Activity Viewing |
| 5 | 21-23 | Search & Autocomplete |
| 6 | 24-30 | Compression, Correction, Stabilization |

---

## Next Steps

1. Review and approve this implementation plan
2. Begin Phase 0: Core Infrastructure setup
3. Set up project tracking and milestones

