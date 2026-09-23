import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const activeKey = serviceKey || anonKey;

  const missingEnv: string[] = [];
  if (!supabaseUrl) missingEnv.push('SUPABASE_URL');
  if (!serviceKey && !anonKey) missingEnv.push('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY');

  let dbStatus = 'NOT_CONFIGURED';
  let dbError: string | null = null;
  let bookingsCount: number | null = null;

  if (supabaseUrl && activeKey && supabaseUrl.startsWith('http') && !supabaseUrl.includes('your-project-ref')) {
    try {
      const supabase = createClient(supabaseUrl, activeKey);
      const { data, count, error } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true });

      if (error) {
        dbStatus = 'CONNECTION_ERROR';
        dbError = error.message;
      } else {
        dbStatus = 'CONNECTED';
        bookingsCount = count ?? 0;
      }
    } catch (err: any) {
      dbStatus = 'EXCEPTION';
      dbError = err.message || String(err);
    }
  }

  res.statusCode = 200;
  res.end(JSON.stringify({
    service: 'ElectroFix BD Status & Diagnostics',
    database_status: dbStatus,
    supabase_configured: dbStatus === 'CONNECTED',
    supabase_url_detected: Boolean(supabaseUrl),
    supabase_service_role_key_detected: Boolean(serviceKey),
    supabase_anon_key_detected: Boolean(anonKey),
    active_key_type: serviceKey ? 'service_role' : (anonKey ? 'anon' : 'none'),
    missing_env: missingEnv.length > 0 ? missingEnv : null,
    bookings_table_count: bookingsCount,
    error: dbError,
    timestamp: new Date().toISOString()
  }, null, 2));
}
