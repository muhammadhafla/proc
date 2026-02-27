-- Procurement System Database Schema
-- Run this in Supabase SQL Editor
--
-- SECURITY NOTES:
-- 1. All functions have SET search_path = '' to prevent privilege escalation
-- 2. For leaked password protection: Enable it in Supabase Dashboard > Authentication > Providers > Email
--    See: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
-- 3. Functions normalize_models_name and insert_procurement_image may exist in Supabase but not in this schema
--
-- Wrap all changes in transaction for atomic deployment
BEGIN;

-- ==================== Organizations ====================

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ==================== Users ====================

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'manager', 'staff')),
  name text,
  email text UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Index for organization lookups
CREATE INDEX IF NOT EXISTS idx_users_org ON public.users(organization_id);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- ==================== Suppliers ====================

CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  normalized_name text NOT NULL,
  phone text,
  location text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Add normalized_name column if not exists (for migration)
ALTER TABLE public.suppliers
ADD COLUMN IF NOT EXISTS normalized_name text;

-- Backfill existing data
UPDATE public.suppliers
SET normalized_name = LOWER(name)
WHERE normalized_name IS NULL;

-- Unique constraint for case-insensitive supplier names
CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_org_name ON public.suppliers(organization_id, normalized_name);

-- Index for organization lookups
CREATE INDEX IF NOT EXISTS idx_suppliers_org ON public.suppliers(organization_id);

-- ==================== Models ====================

CREATE TABLE IF NOT EXISTS public.models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  normalized_name text NOT NULL,
  category text,
  gender text,
  first_seen timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Add normalized_name column if not exists (for migration)
ALTER TABLE public.models
ADD COLUMN IF NOT EXISTS normalized_name text;

-- Backfill existing data
UPDATE public.models
SET normalized_name = LOWER(name)
WHERE normalized_name IS NULL;

-- Unique constraint for case-insensitive model names
CREATE UNIQUE INDEX IF NOT EXISTS idx_models_org_name ON public.models(organization_id, normalized_name);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_models_org ON public.models(organization_id);

-- ==================== Procurement ====================

CREATE TABLE IF NOT EXISTS public.procurement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  model_id uuid REFERENCES public.models(id) ON DELETE SET NULL,
  request_id uuid UNIQUE NOT NULL,
  price numeric NOT NULL CHECK (price > 0),
  currency text DEFAULT 'IDR',
  quantity int DEFAULT 1,
  total_amount numeric GENERATED ALWAYS AS (price * quantity) STORED,
  captured_by uuid REFERENCES auth.users(id),
  captured_at timestamptz DEFAULT now(),
  device_id text,
  batch_id uuid
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_procurement_org ON public.procurement(organization_id);
CREATE INDEX IF NOT EXISTS idx_procurement_org_date ON public.procurement(organization_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_procurement_supplier ON public.procurement(supplier_id);
CREATE INDEX IF NOT EXISTS idx_procurement_model ON public.procurement(model_id);
CREATE INDEX IF NOT EXISTS idx_procurement_captured_at ON public.procurement(captured_at DESC);

-- Composite indexes for analytics
CREATE INDEX IF NOT EXISTS idx_procurement_org_supplier ON public.procurement(organization_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_procurement_org_model ON public.procurement(organization_id, model_id);

-- ==================== Procurement Images ====================

CREATE TABLE IF NOT EXISTS public.procurement_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procurement_id uuid NOT NULL REFERENCES public.procurement(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  content_type text,
  file_size integer,
  variant text DEFAULT 'original',
  archived boolean DEFAULT false,
  last_accessed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Unique constraint for variant
CREATE UNIQUE INDEX IF NOT EXISTS idx_procurement_variant ON public.procurement_images(procurement_id, variant);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_procurement_images_org ON public.procurement_images(organization_id);
CREATE INDEX IF NOT EXISTS idx_procurement_images_proc ON public.procurement_images(procurement_id);

-- Partial index for active (non-archived) images
CREATE INDEX IF NOT EXISTS idx_procurement_images_active ON public.procurement_images(organization_id) WHERE archived = false;

-- ==================== Row Level Security ====================

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_images ENABLE ROW LEVEL SECURITY;

-- ==================== Function to create user on signup ====================

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id uuid;
BEGIN
  -- Set secure search_path to prevent privilege escalation
  SET search_path = '';
  
  -- Check if user already exists (prevent duplicate on OAuth re-signup)
  IF EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;
  
  -- Create a default organization for new users
  INSERT INTO public.organizations (name)
  VALUES (COALESCE(
    NEW.raw_user_meta_data->>'name',
    'My Organization'
  ))
  RETURNING id INTO new_org_id;
  
  -- Create user profile
  INSERT INTO public.users (id, organization_id, role, name, email)
  VALUES (
    NEW.id,
    new_org_id,
    'owner',
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==================== Trigger function to set JWT claims ====================

DROP FUNCTION IF EXISTS public.set_claims() CASCADE;

CREATE OR REPLACE FUNCTION public.set_claims()
RETURNS TRIGGER AS $$
BEGIN
  -- Set secure search_path to prevent privilege escalation
  SET search_path = '';
  
  UPDATE auth.users
  SET 
    raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
      'organization_id', (SELECT organization_id FROM public.users WHERE id = NEW.id),
      'role', (SELECT role FROM public.users WHERE id = NEW.id)
    ),
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
      'organization_id', (SELECT organization_id FROM public.users WHERE id = NEW.id),
      'role', (SELECT role FROM public.users WHERE id = NEW.id)
    )
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_created ON public.users;
CREATE TRIGGER on_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_claims();

-- ==================== Helper Function for RLS ====================

DROP FUNCTION IF EXISTS public.get_user_role_in_org(uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.get_user_role_in_org(org_id uuid)
RETURNS text AS $$
DECLARE
  r text;
BEGIN
  -- Set secure search_path to prevent privilege escalation
  PERFORM set_config('search_path', '', true);
  
  SELECT role INTO r FROM public.users 
  WHERE id = (select auth.uid()) AND organization_id = org_id;
  
  RETURN r;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== Updated RLS Policies ====================

-- Drop old RLS policies first
DROP POLICY IF EXISTS "Public read organizations" ON organizations;
DROP POLICY IF EXISTS "Public insert organizations" ON organizations;
DROP POLICY IF EXISTS "Public update organizations" ON organizations;

DROP POLICY IF EXISTS "Users read own org" ON users;
DROP POLICY IF EXISTS "Users insert own org" ON users;
DROP POLICY IF EXISTS "Users update own org" ON users;

DROP POLICY IF EXISTS "Suppliers read own org" ON suppliers;
DROP POLICY IF EXISTS "Suppliers insert own org" ON suppliers;
DROP POLICY IF EXISTS "Suppliers update own org" ON suppliers;
DROP POLICY IF EXISTS "Suppliers delete own org" ON suppliers;

DROP POLICY IF EXISTS "Models read own org" ON models;
DROP POLICY IF EXISTS "Models insert own org" ON models;
DROP POLICY IF EXISTS "Models update own org" ON models;

DROP POLICY IF EXISTS "Procurement read own org" ON procurement;
DROP POLICY IF EXISTS "Procurement insert own org" ON procurement;
DROP POLICY IF EXISTS "Procurement update own org" ON procurement;

DROP POLICY IF EXISTS "Procurement images read own org" ON procurement_images;
DROP POLICY IF EXISTS "Procurement images insert own org" ON procurement_images;
DROP POLICY IF EXISTS "Procurement images update own org" ON procurement_images;

-- Drop all new policies before recreating
DROP POLICY IF EXISTS "org_select_same_org" ON organizations;
DROP POLICY IF EXISTS "org_insert_owner_or_super" ON organizations;
DROP POLICY IF EXISTS "org_update_owner_or_super" ON organizations;
DROP POLICY IF EXISTS "org_delete_owner_or_super" ON organizations;

DROP POLICY IF EXISTS "users_select_same_org" ON users;
DROP POLICY IF EXISTS "users_insert_same_org" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "users_delete_own" ON users;

DROP POLICY IF EXISTS "suppliers_select_same_org" ON suppliers;
DROP POLICY IF EXISTS "suppliers_insert_same_org" ON suppliers;
DROP POLICY IF EXISTS "suppliers_update_same_org" ON suppliers;
DROP POLICY IF EXISTS "suppliers_delete_same_org" ON suppliers;

DROP POLICY IF EXISTS "models_select_same_org" ON models;
DROP POLICY IF EXISTS "models_insert_same_org" ON models;
DROP POLICY IF EXISTS "models_update_same_org" ON models;
DROP POLICY IF EXISTS "models_delete_same_org" ON models;

DROP POLICY IF EXISTS "procurement_select_same_org" ON procurement;
DROP POLICY IF EXISTS "procurement_insert_same_org" ON procurement;
DROP POLICY IF EXISTS "procurement_no_update" ON procurement;
DROP POLICY IF EXISTS "procurement_no_delete" ON procurement;

DROP POLICY IF EXISTS "procurement_images_select_same_org" ON procurement_images;
DROP POLICY IF EXISTS "procurement_images_insert_same_org" ON procurement_images;
DROP POLICY IF EXISTS "procurement_images_no_update" ON procurement_images;
DROP POLICY IF EXISTS "procurement_images_no_delete" ON procurement_images;
DROP POLICY IF EXISTS "update_last_accessed" ON procurement_images;

-- audit_logs policies will be created after table

-- ==================== Organizations Policies ====================

-- Drop existing policies first
DROP POLICY IF EXISTS "org_select_same_org" ON public.organizations;
DROP POLICY IF EXISTS "org_insert_owner_or_super" ON public.organizations;
DROP POLICY IF EXISTS "org_update_owner_or_super" ON public.organizations;
DROP POLICY IF EXISTS "org_delete_owner_or_super" ON public.organizations;

-- Organizations: Only same organization members can read
CREATE POLICY "org_select_same_org" ON public.organizations
  FOR SELECT USING (
    ((select auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid = id) OR
    EXISTS (SELECT 1 FROM users u WHERE u.id = (select auth.uid()) AND u.organization_id = organizations.id) OR
    (select auth.role()) = 'service_role'
  );

-- Organizations: Only owner can insert (owner of existing org OR user with owner role can create new org)
CREATE POLICY "org_insert_owner_or_super" ON public.organizations
  FOR INSERT WITH CHECK (
    -- Allow if user has owner role in their metadata (can create new org)
    ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner') OR
    -- Allow if user has super_admin role
    ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin') OR
    -- Allow service_role
    ((select auth.role()) = 'service_role') OR
    -- Allow if user is owner of ANY organization (for multi-org owners)
    (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (select auth.uid()) AND u.role = 'owner'))
  );

-- Organizations: Only owner or super_admin can update
CREATE POLICY "org_update_owner_or_super" ON public.organizations
  FOR UPDATE USING (
    (get_user_role_in_org(id) = 'owner') OR
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin' OR
    (select auth.role()) = 'service_role'
  );

-- Organizations: Only owner or super_admin can delete
CREATE POLICY "org_delete_owner_or_super" ON public.organizations
  FOR DELETE USING (
    (get_user_role_in_org(id) = 'owner') OR
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin' OR
    (select auth.role()) = 'service_role'
  );

-- ==================== Users Policies ====================

-- Drop existing policies first
DROP POLICY IF EXISTS "users_select_same_org" ON public.users;
DROP POLICY IF EXISTS "users_insert_same_org" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_delete_own" ON public.users;

CREATE POLICY "users_select_same_org" ON public.users
  FOR SELECT USING (
    (
      organization_id = ((select auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
      OR id = (SELECT (select auth.uid()))
    ) OR
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'super_admin') OR
    (select auth.role()) = 'service_role'
  );

CREATE POLICY "users_insert_same_org" ON public.users
  FOR INSERT WITH CHECK (
    (
      organization_id = ((select auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
      AND id = (SELECT (select auth.uid()))
    ) OR
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'super_admin') OR
    (select auth.role()) = 'service_role'
  );

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (
    (
      id = (SELECT (select auth.uid()))
      AND organization_id = ((select auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    ) OR
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'super_admin') OR
    (select auth.role()) = 'service_role'
  );

CREATE POLICY "users_delete_own" ON public.users
  FOR DELETE USING (
    (
      id = (SELECT (select auth.uid()))
      AND organization_id = ((select auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    ) OR
    (select auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'super_admin') OR
    (select auth.role()) = 'service_role'
  );

-- ==================== Suppliers Policies ====================

-- Drop existing policies first
DROP POLICY IF EXISTS "suppliers_select_same_org" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_insert_same_org" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_update_same_org" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_delete_same_org" ON public.suppliers;

CREATE POLICY "suppliers_select_same_org" ON public.suppliers
  FOR SELECT USING (
    organization_id = ((select auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid) OR
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner' OR
    (select auth.role()) = 'service_role'
  );

CREATE POLICY "suppliers_insert_same_org" ON public.suppliers
  FOR INSERT WITH CHECK (
    organization_id = ((select auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid) OR
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner' OR
    (select auth.role()) = 'service_role'
  );

CREATE POLICY "suppliers_update_same_org" ON public.suppliers
  FOR UPDATE USING (
    organization_id = ((select auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid) OR
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner' OR
    (select auth.role()) = 'service_role'
  );

CREATE POLICY "suppliers_delete_same_org" ON public.suppliers
  FOR DELETE USING (
    organization_id = ((select auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid) OR
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner' OR
    (select auth.role()) = 'service_role'
  );

-- ==================== Models Policies ====================

-- Drop existing policies first
DROP POLICY IF EXISTS "models_select_same_org" ON public.models;
DROP POLICY IF EXISTS "models_insert_same_org" ON public.models;
DROP POLICY IF EXISTS "models_update_same_org" ON public.models;
DROP POLICY IF EXISTS "models_delete_same_org" ON public.models;

CREATE POLICY "models_select_same_org" ON public.models
  FOR SELECT USING (
    organization_id = ((select auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid) OR
    (select auth.role()) = 'service_role'
  );

CREATE POLICY "models_insert_same_org" ON public.models
  FOR INSERT WITH CHECK (
    organization_id = ((select auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid) OR
    (select auth.role()) = 'service_role'
  );

CREATE POLICY "models_update_same_org" ON public.models
  FOR UPDATE USING (
    organization_id = ((select auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid) OR
    (select auth.role()) = 'service_role'
  );

CREATE POLICY "models_delete_same_org" ON public.models
  FOR DELETE USING (
    organization_id = ((select auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid) OR
    (select auth.role()) = 'service_role'
  );

-- ==================== Procurement Policies ====================

-- Drop existing policies first
DROP POLICY IF EXISTS "procurement_select_same_org" ON public.procurement;
DROP POLICY IF EXISTS "procurement_insert_same_org" ON public.procurement;
DROP POLICY IF EXISTS "procurement_no_update" ON public.procurement;
DROP POLICY IF EXISTS "procurement_no_delete" ON public.procurement;

CREATE POLICY "procurement_select_same_org" ON public.procurement
  FOR SELECT USING (
    organization_id = ((select auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid) OR
    (select auth.role()) = 'service_role'
  );

CREATE POLICY "procurement_insert_same_org" ON public.procurement
  FOR INSERT WITH CHECK (
    organization_id = ((select auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid) OR
    (select auth.role()) = 'service_role'
  );

-- Procurement records are immutable - only service_role can update/delete
CREATE POLICY "procurement_no_update" ON public.procurement
  FOR UPDATE USING ((select auth.role()) = 'service_role');

CREATE POLICY "procurement_no_delete" ON public.procurement
  FOR DELETE USING ((select auth.role()) = 'service_role');

-- ==================== Procurement Images Policies ====================

-- Drop existing policies first
DROP POLICY IF EXISTS "procurement_images_select_same_org" ON public.procurement_images;
DROP POLICY IF EXISTS "procurement_images_insert_same_org" ON public.procurement_images;
DROP POLICY IF EXISTS "procurement_images_no_update" ON public.procurement_images;
DROP POLICY IF EXISTS "procurement_images_no_delete" ON public.procurement_images;
DROP POLICY IF EXISTS "update_last_accessed" ON public.procurement_images;

CREATE POLICY "procurement_images_select_same_org" ON public.procurement_images
  FOR SELECT USING (
    (
      organization_id = ((select auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
      AND archived = false
    ) OR
    (select auth.role()) = 'service_role'
  );

CREATE POLICY "procurement_images_insert_same_org" ON public.procurement_images
  FOR INSERT WITH CHECK (
    organization_id = ((select auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid) OR
    (select auth.role()) = 'service_role'
  );

-- Images cannot be updated or deleted by regular users (service role only)
CREATE POLICY "procurement_images_no_update" ON public.procurement_images
  FOR UPDATE USING ((select auth.role()) = 'service_role');

CREATE POLICY "procurement_images_no_delete" ON public.procurement_images
  FOR DELETE USING ((select auth.role()) = 'service_role');

CREATE POLICY "update_last_accessed" ON public.procurement_images
  FOR UPDATE USING (
    organization_id = ((select auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid) OR
    (select auth.role()) = 'service_role'
  )
  WITH CHECK (
    (
      organization_id = ((select auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
      AND last_accessed_at IS NOT NULL
    ) OR
    (select auth.role()) = 'service_role'
  );

-- ==================== Audit Logs ====================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete', 'correction')),
  old_values jsonb,
  new_values jsonb,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- Indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON public.audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON public.audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Audit logs: Organization-based access
-- Drop existing policies first
DROP POLICY IF EXISTS "audit_logs_select_same_org" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_same_org" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_no_update" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_no_delete" ON public.audit_logs;

CREATE POLICY "audit_logs_select_same_org" ON public.audit_logs
  FOR SELECT USING (
    organization_id = ((select auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid) OR
    (select auth.role()) = 'service_role'
  );

-- Audit logs: Insert for organization members
CREATE POLICY "audit_logs_insert_same_org" ON public.audit_logs
  FOR INSERT WITH CHECK (
    organization_id = ((select auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid) OR
    (select auth.role()) = 'service_role'
  );

-- Audit logs: No update or delete
CREATE POLICY "audit_logs_no_update" ON public.audit_logs
  FOR UPDATE USING ((select auth.role()) = 'service_role');

CREATE POLICY "audit_logs_no_delete" ON public.audit_logs
  FOR DELETE USING ((select auth.role()) = 'service_role');

-- ==================== Cleanup Duplicate Indexes ====================
-- These indexes may exist from previous migrations, drop duplicates

-- Models duplicate indexes
DROP INDEX IF EXISTS idx_models_organization_id;
DROP INDEX IF EXISTS ux_models_org_normalized_name;

-- Procurement duplicate indexes
DROP INDEX IF EXISTS idx_procurement_captured_at_desc;
DROP INDEX IF EXISTS idx_procurement_model_id;
DROP INDEX IF EXISTS idx_procurement_organization_id;
DROP INDEX IF EXISTS idx_procurement_supplier_id;

-- Procurement Images duplicate indexes
DROP INDEX IF EXISTS idx_proc_img_org;
DROP INDEX IF EXISTS idx_proc_img_proc;
DROP INDEX IF EXISTS uniq_procurement_variant;

-- Suppliers duplicate index
DROP INDEX IF EXISTS idx_suppliers_organization_id;

-- Users duplicate index
DROP INDEX IF EXISTS idx_users_organization_id;

-- ==================== Remove Extra Policies (fix multiple_permissive_policies) ====================
-- These policies exist in the database but cause multiple permissive policy warnings
-- Drop them to fix the performance issue

DROP POLICY IF EXISTS "insert own images" ON public.procurement_images;
DROP POLICY IF EXISTS "select own images" ON public.procurement_images;
DROP POLICY IF EXISTS "delete_by_service_only" ON public.procurement_images;
DROP POLICY IF EXISTS "update_by_service_only" ON public.procurement_images;

COMMIT;
