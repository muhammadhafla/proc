// Cloudflare Worker - Signed URL Generator
// Deploy to Cloudflare Workers

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
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
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const token = authHeader.replace('Bearer ', '');
      
      // Verify the token with Supabase
      const user = await verifySupabaseToken(token, env);
      if (!user) {
        return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Get user's organization_id from JWT claims
      const organizationId = user.organization_id;
      if (!organizationId) {
        return new Response(JSON.stringify({ error: 'User has no organization' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const url = new URL(request.url);
      
      // Route based on path
      if (url.pathname === '/upload') {
        return handleUpload(request, env, organizationId);
      } else if (url.pathname === '/download') {
        return handleDownload(request, env, organizationId);
      } else {
        return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
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

async function handleUpload(request, env, userOrganizationId) {
  const body = await request.json();
  const { organization_id, file_name, content_type } = body;

  if (!organization_id || !file_name) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // SECURITY: Verify user's organization matches the requested organization
  if (organization_id !== userOrganizationId) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Organization mismatch' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
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
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
      },
    }
  );
}

// ==================== Download Handler ====================

async function handleDownload(request, env, userOrganizationId) {
  const body = await request.json();
  const { storage_path } = body;

  if (!storage_path) {
    return new Response(
      JSON.stringify({ error: 'Missing storage_path' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate path to prevent directory traversal
  if (storage_path.includes('..') || storage_path.startsWith('/')) {
    return new Response(
      JSON.stringify({ error: 'Invalid path' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // SECURITY: Verify the storage path belongs to the user's organization
  const pathOrganizationId = storage_path.split('/')[0];
  if (pathOrganizationId !== userOrganizationId) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Cannot access other organization files' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
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
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
      },
    }
  );
}
