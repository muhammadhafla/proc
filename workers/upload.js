// Cloudflare Worker - Signed URL Generator
// Deploy to Cloudflare Workers

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
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
      const url = new URL(request.url);
      
      // Route based on path
      if (url.pathname === '/upload') {
        return handleUpload(request, env);
      } else if (url.pathname === '/download') {
        return handleDownload(request, env);
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

// ==================== Upload Handler ====================

async function handleUpload(request, env) {
  const body = await request.json();
  const { organization_id, file_name, content_type } = body;

  if (!organization_id || !file_name) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate organization (in production, check against database)
  // For now, we accept any organization_id

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
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

// ==================== Download Handler ====================

async function handleDownload(request, env) {
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
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
