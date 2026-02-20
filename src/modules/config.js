// Configuration for Supabase and Cloudflare
// IMPORTANT: Replace these with your actual credentials

export const config = {
  // Supabase Configuration
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY',
  },
  
  // Cloudflare Worker for signed URLs
  worker: {
    url: import.meta.env.VITE_WORKER_URL || 'YOUR_CLOUDFLARE_WORKER_URL',
  },
  
  // App Configuration
  app: {
    name: 'Procurement System',
    version: '1.0.0',
  },
  
  // Upload Configuration
  upload: {
    maxImageSize: 1200, // Max width in pixels
    jpegQuality: 0.7,   // JPEG quality (0-1)
    maxFileSize: 300 * 1024, // 300KB max
  },
  
  // Sync Configuration
  sync: {
    retryAttempts: 3,
    retryDelay: 2000, // ms
    batchSize: 10,
  },
};
