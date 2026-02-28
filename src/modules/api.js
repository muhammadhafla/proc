// Supabase API Module
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { appState } from './state.js';

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
  // Clear user cache first
  clearUserCache();
  
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
  
  // First check if user exists in users table
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, organization_id, role, name')
    .eq('id', user.id)
    .single();
  
  // User doesn't exist in database - reject login
  if (userError || !userData) {
    console.warn('User not found in database:', user.id);
    throw new Error('USER_NOT_FOUND');
  }
  
  // User exists but not assigned to any organization
  if (!userData.organization_id) {
    console.warn('User has no organization assigned:', user.id);
    throw new Error('USER_NO_ORGANIZATION');
  }
  
  // Fetch the organization details
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', userData.organization_id)
    .single();
  
  if (error) {
    console.error('Failed to fetch organization:', error);
    throw error;
  }
  
  // Return organization with user role info
  return {
    ...data,
    userRole: userData.role,
    userName: userData.name
  };
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
 * Get current access token
 */
async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

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

// ==================== Admin Functions ====================

/**
 * Get current user role from app state
 */
export function getCurrentUserRole() {
  const org = appState?.get?.('organization') || window.appState?.get?.('organization');
  return org?.userRole || null;
}

/**
 * Check if current user has required role
 */
export function hasAdminAccess() {
  const role = getCurrentUserRole();
  return role === 'owner' || role === 'manager';
}

/**
 * Check if current user is owner
 */
export function isOwner() {
  return getCurrentUserRole() === 'owner';
}

// ----- Organizations CRUD (Owner only) -----

/**
 * Get all organizations (Owner only)
 */
export async function adminGetOrganizations() {
  if (!isOwner()) {
    throw new Error('Access denied. Owner role required.');
  }
  
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
}

/**
 * Create organization (Owner only)
 */
export async function adminCreateOrganization(orgData) {
  if (!isOwner()) {
    throw new Error('Access denied. Owner role required.');
  }
  
  const { data, error } = await supabase
    .from('organizations')
    .insert([orgData])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Update organization (Owner only)
 */
export async function adminUpdateOrganization(orgId, orgData) {
  if (!isOwner()) {
    throw new Error('Access denied. Owner role required.');
  }
  
  const { data, error } = await supabase
    .from('organizations')
    .update(orgData)
    .eq('id', orgId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Delete organization (Owner only)
 */
export async function adminDeleteOrganization(orgId) {
  if (!isOwner()) {
    throw new Error('Access denied. Owner role required.');
  }
  
  const { error } = await supabase
    .from('organizations')
    .delete()
    .eq('id', orgId);
  
  if (error) throw error;
  return { success: true };
}

// ----- Users CRUD -----

/**
 * Get all users - either all (owner) or org-specific (manager)
 */
export async function adminGetUsers(organizationId) {
  const role = getCurrentUserRole();
  
  // Managers can only see users in their organization
  if (role !== 'owner') {
    if (!organizationId) {
      const org = appState?.get?.('organization') || window.appState?.get?.('organization');
      organizationId = org?.id;
    }
  }
  
  let query = supabase.from('users').select('*');
  
  // Owner can see all users if orgId is null, otherwise filter
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
}

/**
 * Create user in organization (Owner only - assign role)
 */
export async function adminCreateUser(userData) {
  const role = getCurrentUserRole();
  
  if (role !== 'owner') {
    throw new Error('Access denied. Owner role required to create users.');
  }
  
  const { data, error } = await supabase
    .from('users')
    .insert([userData])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Update user (Owner can change role, Manager can only update staff)
 */
export async function adminUpdateUser(userId, userData) {
  const role = getCurrentUserRole();
  
  // Get current user data
  const { data: currentUser, error: fetchError } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', userId)
    .single();
  
  if (fetchError || !currentUser) {
    throw new Error('User not found');
  }
  
  const org = appState?.get?.('organization') || window.appState?.get?.('organization');
  
  // Manager can only update staff in their organization
  if (role === 'manager') {
    if (currentUser.organization_id !== org?.id) {
      throw new Error('Access denied. User not in your organization.');
    }
    if (currentUser.role === 'owner' || currentUser.role === 'manager') {
      throw new Error('Access denied. Cannot edit owner or manager.');
    }
    // Manager cannot change role
    if (userData.role) {
      throw new Error('Access denied. Cannot change user role.');
    }
  }
  
  const { data, error } = await supabase
    .from('users')
    .update(userData)
    .eq('id', userId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Delete user (Owner only)
 */
export async function adminDeleteUser(userId) {
  const role = getCurrentUserRole();
  
  if (role !== 'owner') {
    throw new Error('Access denied. Owner role required to delete users.');
  }
  
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', userId);
  
  if (error) throw error;
  return { success: true };
}

/**
 * Get staff users (for Manager to add/remove)
 */
export async function adminGetStaff(organizationId) {
  const role = getCurrentUserRole();
  
  if (role !== 'owner' && role !== 'manager') {
    throw new Error('Access denied.');
  }
  
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('role', 'staff')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
}

// ----- Suppliers CRUD -----

/**
 * Get all suppliers - either all (owner) or org-specific (manager)
 */
export async function adminGetSuppliers(organizationId) {
  const role = getCurrentUserRole();
  
  if (role !== 'owner' && role !== 'manager') {
    throw new Error('Access denied.');
  }
  
  let query = supabase.from('suppliers').select('*');
  
  // Filter by organization if provided
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data, error } = await query.order('name');
  
  if (error) {
    throw error;
  }
  return data;
}

/**
 * Create supplier
 */
export async function adminCreateSupplier(supplierData) {
  const role = getCurrentUserRole();
  
  if (role !== 'owner' && role !== 'manager') {
    throw new Error('Access denied.');
  }
  
  const { data, error } = await supabase
    .from('suppliers')
    .insert([supplierData])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Update supplier
 */
export async function adminUpdateSupplier(supplierId, supplierData) {
  const role = getCurrentUserRole();
  
  if (role !== 'owner' && role !== 'manager') {
    throw new Error('Access denied.');
  }
  
  const { data, error } = await supabase
    .from('suppliers')
    .update(supplierData)
    .eq('id', supplierId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Delete supplier
 */
export async function adminDeleteSupplier(supplierId) {
  const role = getCurrentUserRole();
  
  if (role !== 'owner' && role !== 'manager') {
    throw new Error('Access denied.');
  }
  
  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', supplierId);
  
  if (error) throw error;
  return { success: true };
}

// ==================== Export ====================

export { supabase };
