import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

interface RequestWithBody extends IncomingMessage {
  body?: any;
  query?: any;
  params?: any;
  url?: string;
  method?: string;
}

interface ExtendedResponse extends ServerResponse {
  status?: (code: number) => ExtendedResponse;
  json?: (data: any) => void;
}

let bookingCounter = 420;

function generateBookingNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  bookingCounter += 1;
  const randomSuffix = String(Math.floor(10000 + Math.random() * 90000));
  return `EFB-${year}${month}${day}-${randomSuffix}`;
}

function isValidPhone(phone: string): boolean {
  if (!phone) return false;
  const clean = phone.replace(/[\s\-\(\)\+]/g, '');
  return clean.length >= 10 && clean.length <= 15 && /^\d+$/.test(clean);
}

// In-memory fallback across invocations in warm container
const memoryBookings: any[] = [];

export default async function handler(req: RequestWithBody, res: ExtendedResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const sendJson = (statusCode: number, data: any) => {
    res.statusCode = statusCode;
    res.end(JSON.stringify(data));
  };

  // 1. GET - Lookup booking by bookingNumber
  if (req.method === 'GET') {
    const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const pathname = urlObj.pathname;
    const parts = pathname.split('/').filter(Boolean);
    const bookingNumber = parts.length > 2 ? parts[2] : (urlObj.searchParams.get('bookingNumber') || urlObj.searchParams.get('number'));

    if (!bookingNumber) {
      return sendJson(400, { error: 'Missing booking number.' });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('http') && !supabaseUrl.includes('your-project-ref')) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data, error } = await supabase
          .from('bookings')
          .select('*')
          .eq('booking_number', bookingNumber)
          .single();
        if (!error && data) {
          return sendJson(200, { success: true, booking: data });
        }
      } catch (err) {
        console.error('Supabase query error:', err);
      }
    }

    const found = memoryBookings.find(b => b.booking_number === bookingNumber);
    if (found) {
      return sendJson(200, { success: true, booking: found });
    }

    return sendJson(404, { error: 'Booking not found with this booking number.' });
  }

  // 2. POST - Create booking
  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          return sendJson(400, { error: 'Invalid JSON payload.' });
        }
      } else if (!body) {
        // Collect raw body chunks if not parsed by framework
        const buffers: Buffer[] = [];
        for await (const chunk of req) {
          buffers.push(Buffer.from(chunk));
        }
        const raw = Buffer.concat(buffers).toString('utf-8');
        try {
          body = raw ? JSON.parse(raw) : {};
        } catch {
          return sendJson(400, { error: 'Invalid JSON payload.' });
        }
      }

      const { customer_name, phone, address, notes, service_id, service_name } = body || {};

      if (!customer_name || typeof customer_name !== 'string' || customer_name.trim().length < 2) {
        return sendJson(400, { error: 'Please provide a valid customer name (at least 2 characters).' });
      }
      if (!phone || typeof phone !== 'string' || !isValidPhone(phone)) {
        return sendJson(400, { error: 'Please provide a valid phone number (e.g. 01756273504).' });
      }
      if (!address || typeof address !== 'string' || address.trim().length < 3) {
        return sendJson(400, { error: 'Please provide a valid service address in Dhaka.' });
      }

      const booking_number = generateBookingNumber();
      const cleanName = customer_name.trim();
      const cleanPhone = phone.trim();
      const cleanAddress = address.trim();
      const cleanNotes = (notes && typeof notes === 'string') ? notes.trim() : '';
      const selectedServiceName = service_name || 'General Appliance Servicing';
      const selectedServiceId = service_id || 'srv-general';
      const createdAt = new Date().toISOString();

      let savedToSupabase = false;
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('http') && !supabaseUrl.includes('your-project-ref')) {
        try {
          const supabase = createClient(supabaseUrl, supabaseKey);
          const { error } = await supabase.from('bookings').insert([
            {
              booking_number,
              service_id: selectedServiceId,
              service_name: selectedServiceName,
              customer_name: cleanName,
              phone: cleanPhone,
              address: cleanAddress,
              notes: cleanNotes,
              status: 'pending'
            }
          ]);
          if (!error) {
            savedToSupabase = true;
          } else {
            console.error('Supabase booking insert error:', error.message);
          }
        } catch (err) {
          console.error('Error inserting booking into Supabase:', err);
        }
      }

      const record = {
        booking_number,
        customer_name: cleanName,
        service_name: selectedServiceName,
        phone: cleanPhone,
        address: cleanAddress,
        notes: cleanNotes,
        status: 'pending',
        created_at: createdAt,
        saved_to_supabase: savedToSupabase
      };
      memoryBookings.unshift(record);

      return sendJson(201, {
        success: true,
        message: 'Booking request has been submitted successfully.',
        booking: record
      });
    } catch (error: any) {
      console.error('Error handling booking request:', error);
      return sendJson(500, {
        error: 'We could not submit your booking right now. Please call us directly at 01619-487788 or contact on WhatsApp.'
      });
    }
  }

  return sendJson(405, { error: 'Method not allowed.' });
}
