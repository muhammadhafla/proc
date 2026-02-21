// Configuration for Supabase and Cloudflare
// IMPORTANT: Replace these with your actual credentials

export const config = {
  // Supabase Configuration
  supabase: {
    // The raw env values are read below and normalized to avoid
    // accidental concatenation issues in production builds.
    url: (function(){
      const raw = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
      try {
        const u = new URL(String(raw).trim());
        return u.origin.replace(/\/+$/,'');
      } catch (e) {
        // Fallback: trim whitespace and trailing slashes
        return String(raw).trim().replace(/\/+$/,'');
      }
    })(),
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
    logo: '/128x128@2x.png',
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
