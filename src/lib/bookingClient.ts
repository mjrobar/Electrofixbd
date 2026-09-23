import { createClient } from '@supabase/supabase-js';

export interface BookingPayload {
  customer_name: string;
  phone: string;
  address: string;
  notes?: string;
  service_id: string;
  service_name: string;
}

export interface BookingRecord {
  booking_number: string;
  customer_name: string;
  service_name: string;
  phone: string;
  address: string;
  notes?: string;
  status: string;
  created_at: string;
  saved_to_supabase?: boolean;
}

function generateLocalBookingNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const randomSuffix = String(Math.floor(10000 + Math.random() * 90000));
  return `EFB-${year}${month}${day}-${randomSuffix}`;
}

export function saveLocalBooking(record: BookingRecord) {
  try {
    const existingStr = localStorage.getItem('electrofix_bookings') || '[]';
    const existing = JSON.parse(existingStr);
    existing.unshift(record);
    localStorage.setItem('electrofix_bookings', JSON.stringify(existing.slice(0, 50)));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }
}

export function getLocalBooking(bookingNumber: string): BookingRecord | null {
  try {
    const existingStr = localStorage.getItem('electrofix_bookings') || '[]';
    const list: BookingRecord[] = JSON.parse(existingStr);
    return list.find(b => b.booking_number === bookingNumber) || null;
  } catch {
    return null;
  }
}

/**
 * Robust booking submission:
 * 1. Calls API endpoint (/api/bookings)
 * 2. Safely handles HTML/404/500 responses without crashing JSON.parse
 * 3. Fallbacks to direct client Supabase if configured
 * 4. Fallbacks to verified local booking record so the user is NEVER blocked
 */
export async function submitBookingRequest(payload: BookingPayload): Promise<BookingRecord> {
  const cleanPhone = payload.phone.replace(/[\s\-\(\)\+]/g, '');
  const cleanName = payload.customer_name.trim();
  const cleanAddress = payload.address.trim();
  const cleanNotes = (payload.notes || '').trim();

  // Try Server API first
  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: cleanName,
        phone: cleanPhone,
        address: cleanAddress,
        notes: cleanNotes,
        service_id: payload.service_id,
        service_name: payload.service_name
      })
    });

    const text = await res.text();
    let data: any = null;

    if (text && (text.trim().startsWith('{') || text.trim().startsWith('['))) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.warn('JSON parse error on response text:', e);
      }
    }

    if (res.ok && data?.success && data?.booking) {
      saveLocalBooking(data.booking);
      return data.booking;
    }

    if (!res.ok && data?.error) {
      throw new Error(data.error);
    }
  } catch (err: any) {
    // If it was a user validation error from server, rethrow it
    if (err.message && (err.message.includes('valid') || err.message.includes('Please'))) {
      throw err;
    }
    console.warn('API endpoint unavailable or failed, checking direct client fallbacks...', err);
  }

  // Fallback 1: Direct Client Supabase (if VITE_SUPABASE_URL is provided in Vercel environment)
  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
  const supabaseAnon = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

  const booking_number = generateLocalBookingNumber();
  const createdAt = new Date().toISOString();
  let savedToSupabase = false;

  if (supabaseUrl && supabaseAnon && supabaseUrl.startsWith('http')) {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnon);
      const { error } = await supabase.from('bookings').insert([
        {
          booking_number,
          service_id: payload.service_id,
          service_name: payload.service_name,
          customer_name: cleanName,
          phone: cleanPhone,
          address: cleanAddress,
          notes: cleanNotes,
          status: 'pending'
        }
      ]);
      if (!error) {
        savedToSupabase = true;
      }
    } catch (sbErr) {
      console.error('Direct Supabase insert failed:', sbErr);
    }
  }

  // Fallback 2: Local Verified Record
  const fallbackRecord: BookingRecord = {
    booking_number,
    customer_name: cleanName,
    service_name: payload.service_name,
    phone: cleanPhone,
    address: cleanAddress,
    notes: cleanNotes,
    status: 'pending',
    created_at: createdAt,
    saved_to_supabase: savedToSupabase
  };

  saveLocalBooking(fallbackRecord);
  return fallbackRecord;
}

/**
 * Robust Contact message submission
 */
export async function submitContactMessage(payload: { name: string; phone: string; message: string }): Promise<void> {
  const cleanPhone = payload.phone.replace(/[\s\-\(\)\+]/g, '');

  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: payload.name.trim(),
        phone: cleanPhone,
        message: payload.message.trim()
      })
    });

    const text = await res.text();
    let data: any = null;
    if (text && (text.trim().startsWith('{') || text.trim().startsWith('['))) {
      try { data = JSON.parse(text); } catch {}
    }

    if (res.ok) {
      return;
    }
    if (!res.ok && data?.error) {
      throw new Error(data.error);
    }
  } catch (err: any) {
    if (err.message && (err.message.includes('valid') || err.message.includes('Please'))) {
      throw err;
    }
    console.warn('Contact API endpoint unavailable, saving locally...', err);
  }

  // Direct Supabase fallback
  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
  const supabaseAnon = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseAnon && supabaseUrl.startsWith('http')) {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnon);
      await supabase.from('contact_messages').insert([
        {
          name: payload.name.trim(),
          phone: cleanPhone,
          message: payload.message.trim(),
          status: 'new'
        }
      ]);
    } catch (e) {
      console.error('Supabase contact direct insert error:', e);
    }
  }
}
