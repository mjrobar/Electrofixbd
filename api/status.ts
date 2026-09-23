import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const isConfigured = Boolean(supabaseUrl && supabaseKey && supabaseUrl.startsWith('http') && !supabaseUrl.includes('your-project-ref'));

  res.statusCode = 200;
  res.end(JSON.stringify({
    database: isConfigured ? 'supabase-connected' : 'local-ready-for-supabase',
    supabaseConfigured: isConfigured,
    message: isConfigured
      ? 'Supabase database is connected.'
      : 'Ready for Supabase PostgreSQL. Configure SUPABASE_URL and SUPABASE_ANON_KEY in Vercel / .env'
  }));
}
