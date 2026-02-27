-- ==================== Session Management Functions ====================
-- Add these functions to Supabase SQL Editor for session validation
-- Updated with proper NULL handling and security fixes

-- Function to validate session and get session info
-- This function validates the Supabase session token against the auth.users table
DROP FUNCTION IF EXISTS public.validate_session(uuid);

CREATE OR REPLACE FUNCTION public.validate_session(p_session_id uuid)
RETURNS TABLE (
  is_valid boolean,
  user_id uuid,
  email text,
  expires_at timestamptz,
  expires_in_seconds bigint,
  reason text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session RECORD;
  v_now timestamptz := now();
BEGIN
  -- Check if session exists and is valid
  -- Note: Removed is_super_admin check as it's not a default Supabase column
  -- Note: Removed aud check as it's in JWT claims, not users table
  SELECT 
    s.id,
    s.user_id,
    s.expires_at,
    u.email
  INTO v_session
  FROM auth.sessions s
  JOIN auth.users u ON s.user_id = u.id
  WHERE s.id = p_session_id
    AND s.expires_at > v_now
    AND u.email_confirmed_at IS NOT NULL;

  IF v_session IS NULL THEN
    -- Check if session exists but expired
    IF EXISTS (SELECT 1 FROM auth.sessions WHERE id = p_session_id) THEN
      RETURN QUERY SELECT 
        false, 
        null, 
        null, 
        null, 
        null::bigint,
        'Session has expired. Please log in again.'::text;
    ELSE
      RETURN QUERY SELECT 
        false, 
        null, 
        null, 
        null, 
        null::bigint,
        'Session not found. Please log in.'::text;
    END IF;
    RETURN;
  END IF;

  -- Session is valid, return info
  RETURN QUERY SELECT 
    true,
    v_session.user_id,
    v_session.email,
    v_session.expires_at,
    EXTRACT(EPOCH FROM (v_session.expires_at - v_now))::bigint,
    'Session is valid'::text;
END;
$$;

-- Function to get user session status (called from frontend)
DROP FUNCTION IF EXISTS public.get_session_status();

CREATE OR REPLACE FUNCTION public.get_session_status()
RETURNS TABLE (
  is_authenticated boolean,
  user_id uuid,
  email text,
  expires_at timestamptz,
  expires_in_seconds bigint,
  last_activity timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_session_id uuid;
  v_claims text;
  v_now timestamptz := now();
  -- Declare local variables for return columns
  v_expires_at timestamptz;
  v_email text;
BEGIN
  -- Safely get JWT claims
  v_claims := current_setting('request.jwt.claims', true);
  
  -- Check if claims exist (not called from request context)
  IF v_claims IS NULL OR v_claims = '' THEN
    RETURN QUERY SELECT false, NULL, NULL, NULL, NULL, NULL;
    RETURN;
  END IF;

  -- Safely extract user_id from JWT
  BEGIN
    v_user_id := (v_claims::json->>'sub')::uuid;
  EXCEPTION WHEN OTHERS THEN
    -- Invalid JSON or UUID format
    RETURN QUERY SELECT false, NULL, NULL, NULL, NULL, NULL;
    RETURN;
  END;

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, NULL, NULL, NULL, NULL, NULL;
    RETURN;
  END IF;

  -- Hybrid approach: Check JWT expiry first for performance,
  -- then verify session exists in auth.sessions for security
  -- (catches session revocation by admin)
  BEGIN
    v_expires_at := to_timestamp((v_claims::json->>'exp')::bigint);
  EXCEPTION WHEN OTHERS THEN
    -- If JWT parsing fails, return false
    RETURN QUERY SELECT false, v_user_id, NULL, NULL, NULL, NULL;
    RETURN;
  END;

  -- Check if token is still valid based on JWT expiry
  IF v_expires_at IS NOT NULL AND v_expires_at > v_now THEN
    -- JWT is valid, now verify session still exists in auth.sessions
    -- This catches cases where session was revoked (admin logout, password change, etc.)
    SELECT s.id, s.expires_at
    INTO v_session_id, v_expires_at
    FROM auth.sessions s
    WHERE s.user_id = v_user_id
      AND s.expires_at > v_now
    ORDER BY s.created_at DESC
    LIMIT 1;

    -- If no active session found in database, token was revoked
    IF v_session_id IS NULL THEN
      RETURN QUERY SELECT false, v_user_id, NULL, NULL, NULL, NULL;
      RETURN;
    END IF;

    -- Session is valid - get user email
    SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

    RETURN QUERY SELECT 
      true,
      v_user_id,
      v_email,
      v_expires_at,
      EXTRACT(EPOCH FROM (v_expires_at - v_now))::bigint,
      v_now;
    RETURN;
  END IF;

  -- JWT expired - return false
  RETURN QUERY SELECT false, v_user_id, NULL, NULL, NULL, NULL;
END;
$$;

-- Grant access to auth schema tables for session validation
-- These grants are needed by get_session_status() to query auth.sessions
GRANT SELECT ON auth.sessions TO authenticated;
GRANT SELECT ON auth.users TO authenticated;

-- Function to terminate all sessions for a user (except current if specified)
DROP FUNCTION IF EXISTS public.terminate_all_sessions(uuid, uuid);

CREATE OR REPLACE FUNCTION public.terminate_all_sessions(p_user_id uuid, p_exclude_session_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Delete all sessions for the user, optionally excluding current session
  IF p_exclude_session_id IS NOT NULL THEN
    DELETE FROM auth.sessions 
    WHERE user_id = p_user_id 
    AND id <> p_exclude_session_id;
  ELSE
    DELETE FROM auth.sessions WHERE user_id = p_user_id;
  END IF;
  RETURN true;
END;
$$;

-- Function to terminate sessions by current JWT (excludes current session)
DROP FUNCTION IF EXISTS public.terminate_other_sessions();

CREATE OR REPLACE FUNCTION public.terminate_other_sessions()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_current_session_id uuid;
  v_claims text;
BEGIN
  -- Safely get JWT claims
  v_claims := current_setting('request.jwt.claims', true);
  
  IF v_claims IS NULL OR v_claims = '' THEN
    RETURN false;
  END IF;

  BEGIN
    v_user_id := (v_claims::json->>'sub')::uuid;
    v_current_session_id := (v_claims::json->>'session_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  IF v_user_id IS NULL OR v_current_session_id IS NULL THEN
    RETURN false;
  END IF;

  -- Delete all sessions except the current one
  DELETE FROM auth.sessions 
  WHERE user_id = v_user_id 
  AND id <> v_current_session_id;
  
  RETURN true;
END;
$$;

-- Function to record session activity (update last activity)
-- Note: Supabase sessions table may not have updated_at column
-- This function is kept for future use if needed
DROP FUNCTION IF EXISTS public.record_session_activity(uuid);

CREATE OR REPLACE FUNCTION public.record_session_activity(p_session_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Note: auth.sessions table may not have updated_at column in all Supabase versions
  -- If it exists, uncomment below. Otherwise this is a no-op for session table.
  -- UPDATE auth.sessions 
  -- SET updated_at = now()
  -- WHERE id = p_session_id;
  
  -- Instead, we'll just return true as activity is recorded in user_activity table
  RETURN true;
END;
$$;

-- Create a table to track user activity for idle detection
CREATE TABLE IF NOT EXISTS public.user_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_activity timestamptz DEFAULT now(),
  idle_timeout_minutes int DEFAULT 15,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Index for user activity lookups
CREATE INDEX IF NOT EXISTS idx_user_activity_user ON public.user_activity(user_id);

-- Partial unique index for active user activity (only one active record per user)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_activity_active ON public.user_activity(user_id) WHERE is_active = true;

-- Function to update user activity
DROP FUNCTION IF EXISTS public.update_user_activity();

CREATE OR REPLACE FUNCTION public.update_user_activity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_activity_id uuid;
  v_claims text;
  v_last_activity timestamptz;
BEGIN
  -- Safely get JWT claims
  v_claims := current_setting('request.jwt.claims', true);
  
  IF v_claims IS NULL OR v_claims = '' THEN
    RETURN;
  END IF;

  BEGIN
    v_user_id := (v_claims::json->>'sub')::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Use UPSERT pattern to handle multiple records
  -- First, deactivate any existing records for this user
  UPDATE public.user_activity 
  SET is_active = false 
  WHERE user_id = v_user_id AND is_active = true;

  -- Insert new active record
  INSERT INTO public.user_activity (user_id, last_activity, is_active)
  VALUES (v_user_id, now(), true)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Function to check if user is idle
DROP FUNCTION IF EXISTS public.check_user_idle(uuid, int);

CREATE OR REPLACE FUNCTION public.check_user_idle(p_user_id uuid, p_timeout_minutes int DEFAULT 15)
RETURNS TABLE (
  is_idle boolean,
  idle_duration_minutes bigint,
  last_activity timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_last_activity timestamptz;
  v_idle_duration bigint;
BEGIN
  -- Get the most recent active activity for the user
  SELECT last_activity INTO v_last_activity
  FROM public.user_activity
  WHERE user_id = p_user_id AND is_active = true
  ORDER BY last_activity DESC
  LIMIT 1;

  IF v_last_activity IS NULL THEN
    RETURN QUERY SELECT false, 0::bigint, NULL;
    RETURN;
  END IF;

  -- Calculate idle duration in minutes
  v_idle_duration := FLOOR(EXTRACT(EPOCH FROM (now() - v_last_activity)) / 60)::bigint;

  RETURN QUERY SELECT 
    v_idle_duration > p_timeout_minutes,
    v_idle_duration,
    v_last_activity;
END;
$$;

-- Function to cleanup old user activity records
DROP FUNCTION IF EXISTS public.cleanup_user_activity();

CREATE OR REPLACE FUNCTION public.cleanup_user_activity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Delete inactive records older than 7 days
  DELETE FROM public.user_activity 
  WHERE is_active = false 
  AND created_at < NOW() - INTERVAL '7 days';
END;
$$;
