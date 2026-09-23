import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory fallback storage for when Supabase is not yet configured
interface LocalBookingRecord {
  id: string;
  booking_number: string;
  service_id: string;
  service_name: string;
  customer_name: string;
  phone: string;
  address: string;
  notes: string;
  status: string;
  created_at: string;
}

interface LocalContactRecord {
  id: string;
  name: string;
  phone: string;
  message: string;
  status: string;
  created_at: string;
}

const localBookings: LocalBookingRecord[] = [];
const localContacts: LocalContactRecord[] = [];
let bookingCounter = 420;

// Lazy Supabase client initialization
let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (url && key && url.startsWith('http') && !url.includes('your-project-ref')) {
    try {
      supabaseClient = createClient(url, key);
      return supabaseClient;
    } catch (e) {
      console.error('Failed to initialize Supabase client:', e);
      return null;
    }
  }
  return null;
}

// Server-side booking number generator: EFB-YYYYMMDD-XXXXX
function generateBookingNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  bookingCounter += 1;
  const randomSuffix = String(Math.floor(10000 + Math.random() * 90000));
  return `EFB-${year}${month}${day}-${randomSuffix}`;
}

// Phone validator: accepts Bangladeshi numbers (01XXXXXXXXX) and standard phone numbers
function isValidPhone(phone: string): boolean {
  if (!phone) return false;
  const clean = phone.replace(/[\s\-\(\)\+]/g, '');
  return clean.length >= 10 && clean.length <= 15 && /^\d+$/.test(clean);
}

// ======================== API ROUTES ========================

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ElectroFix BD API',
    timestamp: new Date().toISOString()
  });
});

// 2. Database connection status
app.get('/api/status', (req, res) => {
  const supabase = getSupabase();
  res.json({
    database: supabase ? 'supabase-connected' : 'local-ready-for-supabase',
    supabaseConfigured: !!supabase,
    message: supabase 
      ? 'Supabase database is connected.'
      : 'Running in resilient development mode. Provide SUPABASE_URL and SUPABASE_ANON_KEY to sync to Supabase PostgreSQL.'
  });
});

// 3. Create Booking
app.post('/api/bookings', async (req, res) => {
  try {
    const { customer_name, phone, address, notes, service_id, service_name } = req.body;

    // Server-side validation
    if (!customer_name || typeof customer_name !== 'string' || customer_name.trim().length < 2) {
      return res.status(400).json({ error: 'Please provide a valid customer name (at least 2 characters).' });
    }
    if (!phone || typeof phone !== 'string' || !isValidPhone(phone)) {
      return res.status(400).json({ error: 'Please provide a valid 11-digit phone number (e.g. 01619487788).' });
    }
    if (!address || typeof address !== 'string' || address.trim().length < 3) {
      return res.status(400).json({ error: 'Please provide a valid service address in Dhaka.' });
    }

    const booking_number = generateBookingNumber();
    const cleanName = customer_name.trim();
    const cleanPhone = phone.trim();
    const cleanAddress = address.trim();
    const cleanNotes = (notes && typeof notes === 'string') ? notes.trim() : '';
    const selectedServiceName = service_name || 'General Appliance Servicing';
    const selectedServiceId = service_id || 'srv-general';
    const createdAt = new Date().toISOString();

    const supabase = getSupabase();
    let savedToSupabase = false;

    if (supabase) {
      try {
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

    // Always keep in local store as well for instant fast retrieval
    const record: LocalBookingRecord = {
      id: `local-${Date.now()}`,
      booking_number,
      service_id: selectedServiceId,
      service_name: selectedServiceName,
      customer_name: cleanName,
      phone: cleanPhone,
      address: cleanAddress,
      notes: cleanNotes,
      status: 'pending',
      created_at: createdAt
    };
    localBookings.unshift(record);

    return res.status(201).json({
      success: true,
      message: 'Booking request has been submitted successfully.',
      booking: {
        booking_number,
        customer_name: cleanName,
        service_name: selectedServiceName,
        phone: cleanPhone,
        address: cleanAddress,
        status: 'pending',
        created_at: createdAt,
        saved_to_supabase: savedToSupabase
      }
    });
  } catch (error) {
    console.error('Error in /api/bookings:', error);
    return res.status(500).json({
      error: 'We could not submit your booking right now. Please try again or contact us on WhatsApp: 01619-487788.'
    });
  }
});

// 4. Get booking by booking number
app.get('/api/bookings/:bookingNumber', async (req, res) => {
  const { bookingNumber } = req.params;
  if (!bookingNumber) {
    return res.status(400).json({ error: 'Missing booking number.' });
  }

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('booking_number', bookingNumber)
        .single();
      if (!error && data) {
        return res.json({ success: true, booking: data });
      }
    } catch (err) {
      console.error('Error querying Supabase booking:', err);
    }
  }

  // Fallback to local
  const found = localBookings.find(b => b.booking_number === bookingNumber);
  if (found) {
    return res.json({ success: true, booking: found });
  }

  return res.status(404).json({ error: 'Booking not found with this booking number.' });
});

// 5. Contact Form Submission
app.post('/api/contact', async (req, res) => {
  try {
    const { name, phone, message } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Please enter your name.' });
    }
    if (!phone || typeof phone !== 'string' || !isValidPhone(phone)) {
      return res.status(400).json({ error: 'Please enter a valid phone number.' });
    }
    if (!message || typeof message !== 'string' || message.trim().length < 5) {
      return res.status(400).json({ error: 'Please write a message describing your appliance issue.' });
    }

    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanMessage = message.trim();
    const createdAt = new Date().toISOString();

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('contact_messages').insert([
          { name: cleanName, phone: cleanPhone, message: cleanMessage, status: 'new' }
        ]);
      } catch (err) {
        console.error('Error inserting contact message into Supabase:', err);
      }
    }

    localContacts.unshift({
      id: `contact-${Date.now()}`,
      name: cleanName,
      phone: cleanPhone,
      message: cleanMessage,
      status: 'new',
      created_at: createdAt
    });

    return res.status(200).json({
      success: true,
      message: 'Thank you for contacting ElectroFix BD. We have received your message and will contact you shortly.'
    });
  } catch (error) {
    console.error('Error in /api/contact:', error);
    return res.status(500).json({
      error: 'We could not send your message right now. Please call us directly at 01619-487788.'
    });
  }
});

// ======================== VITE & STATIC HANDLING ========================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ElectroFix BD Server running on http://localhost:${PORT}`);
  });
}

startServer();
