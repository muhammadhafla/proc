-- Procurement System Database Schema
-- Run this in Supabase SQL Editor

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
  created_at timestamptz DEFAULT now()
);

-- Index for organization lookups
CREATE INDEX idx_users_org ON public.users(organization_id);

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

-- Unique constraint for case-insensitive supplier names
CREATE UNIQUE INDEX idx_suppliers_org_name ON public.suppliers(organization_id, normalized_name);

-- Index for organization lookups
CREATE INDEX idx_suppliers_org ON public.suppliers(organization_id);

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

-- Unique constraint for case-insensitive model names
CREATE UNIQUE INDEX idx_models_org_name ON public.models(organization_id, normalized_name);

-- Indexes
CREATE INDEX idx_models_org ON public.models(organization_id);

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
CREATE INDEX idx_procurement_org ON public.procurement(organization_id);
CREATE INDEX idx_procurement_org_date ON public.procurement(organization_id, captured_at DESC);
CREATE INDEX idx_procurement_supplier ON public.procurement(supplier_id);
CREATE INDEX idx_procurement_model ON public.procurement(model_id);
CREATE INDEX idx_procurement_captured_at ON public.procurement(captured_at DESC);

-- ==================== Procurement Images ====================

CREATE TABLE IF NOT EXISTS public.procurement_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procurement_id uuid NOT NULL REFERENCES public.procurement(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  content_type text,
  file_size integer,
  variant text DEFAULT 'original',
  created_at timestamptz DEFAULT now()
);

-- Unique constraint for variant
CREATE UNIQUE INDEX idx_procurement_variant ON public.procurement_images(procurement_id, variant);

-- Indexes
CREATE INDEX idx_procurement_images_org ON public.procurement_images(organization_id);
CREATE INDEX idx_procurement_images_proc ON public.procurement_images(procurement_id);

-- ==================== Row Level Security ====================

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_images ENABLE ROW LEVEL SECURITY;

-- Organizations: Public read for now (can be restricted later)
CREATE POLICY "Public read organizations" ON public.organizations
  FOR SELECT USING (true);

CREATE POLICY "Public insert organizations" ON public.organizations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update organizations" ON public.organizations
  FOR UPDATE USING (true);

-- Users: Organization-based access
CREATE POLICY "Users read own org" ON public.users
  FOR SELECT USING (
    organization_id = (auth.jwt() ->> 'organization_id')::uuid
  );

CREATE POLICY "Users insert own org" ON public.users
  FOR INSERT WITH CHECK (
    organization_id = (auth.jwt() ->> 'organization_id')::uuid
  );

CREATE POLICY "Users update own org" ON public.users
  FOR UPDATE USING (
    organization_id = (auth.jwt() ->> 'organization_id')::uuid
  );

-- Suppliers: Organization-based access
CREATE POLICY "Suppliers read own org" ON public.suppliers
  FOR SELECT USING (
    organization_id = (auth.jwt() ->> 'organization_id')::uuid
  );

CREATE POLICY "Suppliers insert own org" ON public.suppliers
  FOR INSERT WITH CHECK (
    organization_id = (auth.jwt() ->> 'organization_id')::uuid
  );

CREATE POLICY "Suppliers update own org" ON public.suppliers
  FOR UPDATE USING (
    organization_id = (auth.jwt() ->> 'organization_id')::uuid
  );

-- Models: Organization-based access
CREATE POLICY "Models read own org" ON public.models
  FOR SELECT USING (
    organization_id = (auth.jwt() ->> 'organization_id')::uuid
  );

CREATE POLICY "Models insert own org" ON public.models
  FOR INSERT WITH CHECK (
    organization_id = (auth.jwt() ->> 'organization_id')::uuid
  );

CREATE POLICY "Models update own org" ON public.models
  FOR UPDATE USING (
    organization_id = (auth.jwt() ->> 'organization_id')::uuid
  );

-- Procurement: Organization-based access
CREATE POLICY "Procurement read own org" ON public.procurement
  FOR SELECT USING (
    organization_id = (auth.jwt() ->> 'organization_id')::uuid
  );

CREATE POLICY "Procurement insert own org" ON public.procurement
  FOR INSERT WITH CHECK (
    organization_id = (auth.jwt() ->> 'organization_id')::uuid
  );

CREATE POLICY "Procurement update own org" ON public.procurement
  FOR UPDATE USING (
    organization_id = (auth.jwt() ->> 'organization_id')::uuid
  );

-- Procurement Images: Organization-based access
CREATE POLICY "Procurement images read own org" ON public.procurement_images
  FOR SELECT USING (
    organization_id = (auth.jwt() ->> 'organization_id')::uuid
  );

CREATE POLICY "Procurement images insert own org" ON public.procurement_images
  FOR INSERT WITH CHECK (
    organization_id = (auth.jwt() ->> 'organization_id')::uuid
  );

CREATE POLICY "Procurement images update own org" ON public.procurement_images
  FOR UPDATE USING (
    organization_id = (auth.jwt() ->> 'organization_id')::uuid
  );

-- ==================== Function to create user on signup ====================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create a default organization for new users
  INSERT INTO public.organizations (name)
  VALUES (COALESCE(
    (SELECT name FROM auth.user_metadata),
    'My Organization'
  ))
  RETURNING id INTO NEW.organization_id;
  
  -- Create user profile
  INSERT INTO public.users (id, organization_id, role, name)
  VALUES (
    NEW.id,
    NEW.organization_id,
    'owner',
    COALESCE(NEW.raw_user_meta_data->>'name', 'User')
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

CREATE OR REPLACE FUNCTION public.set_claims()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET 
    raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
      'organization_id', (SELECT organization_id FROM public.users WHERE id = NEW.id)
    ),
    raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
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
