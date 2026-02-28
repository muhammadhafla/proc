// Cloudflare Worker - Signed URL Generator
// Deploy to Cloudflare Workers

// Get allowed origin from environment
const ALLOWED_ORIGIN = env.ALLOWED_ORIGIN || '';

// Determine CORS origin - empty means same-origin only
const CORS_ORIGIN = ALLOWED_ORIGIN === '*' || !ALLOWED_ORIGIN 
  ? ''  // Let browser enforce same-origin
  : ALLOWED_ORIGIN;

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin) {
  if (!CORS_ORIGIN) return true; // Same-origin only
  if (!origin) return false;
  
  // Support multiple origins (comma-separated)
  return CORS_ORIGIN.split(',').some(allowed => 
    allowed.trim() === origin || allowed.trim() === '*'
  );
}

/**
 * Get CORS headers based on allowed origin
 */
function getCorsHeaders(origin) {
  const allowedOrigin = CORS_ORIGIN || origin || '';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      const origin = request.headers.get('Origin') || '';
      
      // Validate origin on preflight
      if (!isOriginAllowed(origin)) {
        return new Response('Origin not allowed', { 
          status: 403,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
      
      return new Response(null, {
        headers: getCorsHeaders(origin),
      });
    }

    // Validate origin on actual request
    const origin = request.headers.get('Origin') || '';
    if (!isOriginAllowed(origin)) {
      return new Response('Origin not allowed', { 
        status: 403,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // Only allow POST
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      // Verify JWT token from Authorization header
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Missing or invalid authorization header' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
        });
      }

      const token = authHeader.replace('Bearer ', '');
      
      // Verify the token with Supabase
      const user = await verifySupabaseToken(token, env);
      if (!user) {
        return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
        });
      }

      // Get user's organization_id from JWT claims
      const organizationId = user.organization_id;
      if (!organizationId) {
        return new Response(JSON.stringify({ error: 'User has no organization' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
        });
      }

      const url = new URL(request.url);
      
      // Route based on path
      if (url.pathname === '/upload') {
        return handleUpload(request, env, organizationId, origin);
      } else if (url.pathname === '/download') {
        return handleDownload(request, env, organizationId, origin);
      } else {
        return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
      });
    }
  },
};

// ==================== JWT Verification ====================

async function verifySupabaseToken(token, env) {
  try {
    // Verify token with Supabase
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': env.SUPABASE_ANON_KEY,
      },
    });

    if (!response.ok) {
      return null;
    }

    const user = await response.json();
    return user;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

// ==================== Upload Handler ====================

async function handleUpload(request, env, userOrganizationId, origin) {
  const body = await request.json();
  const { organization_id, file_name, content_type } = body;

  if (!organization_id || !file_name) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) } }
    );
  }

  // SECURITY: Verify user's organization matches the requested organization
  if (organization_id !== userOrganizationId) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Organization mismatch' }),
      { status: 403, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) } }
    );
  }

  // Generate unique object key
  const objectKey = `${organization_id}/${Date.now()}-${file_name}`;

  // Create presigned URL for upload
  const uploadUrl = await env.procurement_images.createPresignedUploadUrl(objectKey, {
    expiry: 900, // 15 minutes
    contentType: content_type || 'image/jpeg',
  });

  return new Response(
    JSON.stringify({
      uploadUrl: uploadUrl.url,
      fields: uploadUrl.fields,
      storagePath: objectKey,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(origin),
      },
    }
  );
}

// ==================== Download Handler ====================

async function handleDownload(request, env, userOrganizationId, origin) {
  const body = await request.json();
  const { storage_path } = body;

  if (!storage_path) {
    return new Response(
      JSON.stringify({ error: 'Missing storage_path' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) } }
    );
  }

  // Validate path to prevent directory traversal
  if (storage_path.includes('..') || storage_path.startsWith('/')) {
    return new Response(
      JSON.stringify({ error: 'Invalid path' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) } }
    );
  }

  // SECURITY: Verify the storage path belongs to the user's organization
  const pathOrganizationId = storage_path.split('/')[0];
  if (pathOrganizationId !== userOrganizationId) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Cannot access other organization files' }),
      { status: 403, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) } }
    );
  }

  // Generate presigned URL for download
  const downloadUrl = await env.procurement_images.createPresignedGetUrl(storage_path, 60); // 60 seconds

  return new Response(
    JSON.stringify({
      downloadUrl: downloadUrl,
      storagePath: storage_path,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(origin),
      },
    }
  );
}
