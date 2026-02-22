// Supabase API Module
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

// Initialize Supabase client
const supabase = createClient(
  config.supabase.url,
  config.supabase.anonKey
);

// User cache for performance
let cachedUser = null;
let cachedUserTime = 0;
const USER_CACHE_DURATION = 30000; // 30 seconds

// ==================== Authentication ====================

/**
 * Sign in with email (magic link)
 */
export async function signInWithEmail(email) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
    },
  });
  
  if (error) throw error;
  return data;
}

/**
 * Sign out
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get current session
 */
export function getSession() {
  return supabase.auth.getSession();
}

/**
 * Get current user - with caching for performance
 */
export function getUser() {
  const now = Date.now();
  
  // Return cached user if still valid
  if (cachedUser && (now - cachedUserTime) < USER_CACHE_DURATION) {
    return { data: { user: cachedUser }, error: null };
  }
  
  // Fetch fresh user and cache it
  return supabase.auth.getUser().then(result => {
    if (result.data?.user) {
      cachedUser = result.data.user;
      cachedUserTime = now;
    }
    return result;
  });
}

/**
 * Clear user cache - call on sign out
 */
export function clearUserCache() {
  cachedUser = null;
  cachedUserTime = 0;
}

/**
 * Get current user role in organization
 */
export async function getUserRole() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  // Try to get role from metadata first (set by JWT claims)
  const role = user.user_metadata?.role;
  if (role) return role;
  
  // Fallback: fetch from users table
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();
  
  if (error) return null;
  return data?.role;
}

/**
 * Subscribe to auth changes
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

// ==================== Organizations ====================

/**
 * Get current user's organization
 */
export async function getOrganization() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data, error } = await supabase
    .from('users')
    .select('organizations(*)')
    .eq('id', user.id)
    .single();
  
  if (error) {
    // Handle the case where user record doesn't exist (HTTP 406)
    if (error.code === 'PGRST116' || error.message?.includes('Cannot coerce')) {
      console.warn('User record not found in database - user may need to be provisioned:', user.id);
      return null;
    }
    throw error;
  }
  return data?.organizations;
}

// ==================== Suppliers ====================

/**
 * Fetch suppliers from server
 */
export async function fetchSuppliers(organizationId) {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name');
  
  if (error) throw error;
  return data;
}

/**
 * Create a new supplier
 */
export async function createSupplier(supplier) {
  const { data, error } = await supabase
    .from('suppliers')
    .insert([supplier])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// ==================== Models ====================

/**
 * Fetch models from server
 */
export async function fetchModels(organizationId, limit = 100) {
  const { data, error } = await supabase
    .from('models')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name')
    .limit(limit);
  
  if (error) throw error;
  return data;
}

/**
 * Create a new model
 */
export async function createModel(model) {
  const { data, error } = await supabase
    .from('models')
    .insert([model])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Search models on server
 */
export async function searchModelsServer(organizationId, query) {
  const { data, error } = await supabase
    .from('models')
    .select('*')
    .eq('organization_id', organizationId)
    .ilike('normalized_name', `%${query.toLowerCase().trim()}%`)
    .limit(20);
  
  if (error) throw error;
  return data;
}

// ==================== Procurement ====================

/**
 * Fetch recent procurements
 */
export async function fetchProcurements(organizationId, page = 1, limit = 50) {
  const offset = (page - 1) * limit;
  
  const { data, error } = await supabase
    .from('procurement')
    .select(`
      *,
      suppliers(name),
      models(name)
    `)
    .eq('organization_id', organizationId)
    .order('captured_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (error) throw error;
  return data;
}

/**
 * Create procurement record
 */
export async function createProcurement(procurement) {
  const { data, error } = await supabase
    .from('procurement')
    .insert([procurement])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Get procurement by ID with details
 */
export async function getProcurementDetails(procurementId) {
  const { data, error } = await supabase
    .from('procurement')
    .select(`
      *,
      suppliers(*),
      models(*),
      procurement_images(*)
    `)
    .eq('id', procurementId)
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Update procurement record (correction)
 */
export async function updateProcurement(procurementId, updates) {
  const { data, error } = await supabase
    .from('procurement')
    .update(updates)
    .eq('id', procurementId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Get audit logs for a procurement record
 */
export async function getAuditLogs(procurementId) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select(`
      *,
      users:user_id(name)
    `)
    .eq('table_name', 'procurement')
    .eq('record_id', procurementId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
}

/**
 * Create audit log entry
 */
export async function createAuditLog(auditLog) {
  const { data, error } = await supabase
    .from('audit_logs')
    .insert([auditLog])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// ==================== Procurement Images ====================

/**
 * Create image metadata record
 */
export async function createProcurementImage(imageData) {
  const { data, error } = await supabase
    .from('procurement_images')
    .insert([imageData])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// ==================== Worker/Signed URL ====================

/**
 * Get signed upload URL from Cloudflare Worker
 */
export async function getSignedUploadUrl(organizationId, fileName, contentType) {
  const token = await getAccessToken();
  
  const response = await fetch(`${config.worker.url}/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      organization_id: organizationId,
      file_name: fileName,
      content_type: contentType,
    }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to get signed upload URL');
  }
  
  return response.json();
}

/**
 * Get signed download URL from Cloudflare Worker
 */
export async function getSignedDownloadUrl(storagePath) {
  const token = await getAccessToken();
  
  const response = await fetch(`${config.worker.url}/download`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      storage_path: storagePath,
    }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to get signed download URL');
  }
  
  return response.json();
}

/**
 * Get current access token
 */
async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

// ==================== Export ====================

export { supabase };
