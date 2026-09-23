import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

interface RequestWithBody extends IncomingMessage {
  body?: any;
}

export default async function handler(req: RequestWithBody, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

  if (req.method !== 'POST') {
    return sendJson(405, { error: 'Method not allowed.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { return sendJson(400, { error: 'Invalid JSON payload.' }); }
    } else if (!body) {
      const buffers: Buffer[] = [];
      for await (const chunk of req) {
        buffers.push(Buffer.from(chunk));
      }
      const raw = Buffer.concat(buffers).toString('utf-8');
      try { body = raw ? JSON.parse(raw) : {}; } catch { return sendJson(400, { error: 'Invalid JSON payload.' }); }
    }

    const { name, phone, message } = body || {};
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return sendJson(400, { error: 'Please enter your name.' });
    }
    if (!phone || typeof phone !== 'string' || phone.trim().length < 10) {
      return sendJson(400, { error: 'Please enter a valid phone number.' });
    }
    if (!message || typeof message !== 'string' || message.trim().length < 5) {
      return sendJson(400, { error: 'Please write a message describing your appliance issue.' });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('http') && !supabaseUrl.includes('your-project-ref')) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.from('contact_messages').insert([
          { name: name.trim(), phone: phone.trim(), message: message.trim(), status: 'new' }
        ]);
      } catch (err) {
        console.error('Supabase contact insert error:', err);
      }
    }

    return sendJson(200, {
      success: true,
      message: 'Thank you for contacting ElectroFix BD. We have received your message and will contact you shortly.'
    });
  } catch (error: any) {
    console.error('Error handling contact message:', error);
    return sendJson(500, {
      error: 'We could not send your message right now. Please call us directly at 01619-487788.'
    });
  }
}
