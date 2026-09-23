import React, { useState, useEffect } from 'react';
import { Database, CheckCircle2, ChevronRight, X, Copy, Check, Terminal, ExternalLink } from 'lucide-react';

export const DatabaseStatusBanner: React.FC = () => {
  const [statusData, setStatusData] = useState<{
    database: string;
    supabaseConfigured: boolean;
    message: string;
  } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    fetch('/api/status')
      .then(async (res) => {
        if (!res.ok) return null;
        const text = await res.text();
        if (text && (text.trim().startsWith('{') || text.trim().startsWith('['))) {
          return JSON.parse(text);
        }
        return null;
      })
      .then((data) => {
        if (data) setStatusData(data);
      })
      .catch((err) => console.warn('Status check warning:', err));
  }, []);

  const handleCopySqlInstructions = () => {
    navigator.clipboard.writeText(
      `-- Run the provided supabase-schema.sql in your Supabase SQL Editor\n-- https://supabase.com/dashboard/project/_/sql`
    );
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  if (!statusData) return null;

  return (
    <>
      {/* Subtle indicator bar */}
      <div className="bg-[#17202A] text-white/90 text-xs py-1.5 px-4 border-b border-slate-700">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              Database Engine:{' '}
              {statusData.supabaseConfigured ? (
                <span className="text-emerald-400 font-semibold">Supabase Connected (PostgreSQL)</span>
              ) : (
                <span className="text-amber-300 font-semibold">Ready for Supabase PostgreSQL Integration</span>
              )}
            </span>
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1 text-[11px] text-white/80 hover:text-white underline cursor-pointer"
          >
            <span>Supabase Schema & Settings</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Supabase Integration Details Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-[#DCE3E8] p-6 space-y-4">
            
            <div className="flex items-center justify-between border-b border-[#DCE3E8] pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-[#004179]" />
                <h3 className="text-base font-bold text-[#17202A]">Supabase Database Configuration</h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-[#5F6B76] space-y-3">
              <p>
                ElectroFix BD is designed with full-stack support for <strong>Supabase PostgreSQL</strong>.
                The application features automatic booking creation, server-side validation, and instant generation of booking numbers.
              </p>

              <div className="bg-[#F5F7F9] p-3 rounded-lg border border-[#DCE3E8] space-y-2">
                <div className="font-bold text-[#17202A]">Status:</div>
                <div className="flex items-center gap-2">
                  {statusData.supabaseConfigured ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Supabase is connected with live PostgreSQL credentials!
                    </span>
                  ) : (
                    <span className="text-slate-700">
                      Running in local/in-memory mode with full server validation. To connect your Supabase project, configure the credentials below.
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="font-bold text-[#17202A]">Required Environment Variables:</div>
                <div className="bg-[#17202A] text-slate-200 p-3 rounded-lg font-mono text-[11px] space-y-1">
                  <div>SUPABASE_URL=https://your-project-id.supabase.co</div>
                  <div>SUPABASE_ANON_KEY=your-supabase-anon-key</div>
                  <div>SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key</div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="font-bold text-[#17202A]">Pre-built SQL Schema:</div>
                <p className="text-[11px]">
                  A complete schema file <code>supabase-schema.sql</code> with tables (<code>services</code>, <code>bookings</code>, <code>works</code>, <code>testimonials</code>, <code>contact_messages</code>), indexes, and RLS policies is already prepared at the root of the project!
                </p>
                <button
                  onClick={handleCopySqlInstructions}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#004179] text-white rounded text-xs font-semibold hover:bg-[#00325E] transition-colors cursor-pointer"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied info!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy SQL Schema Path</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-[#DCE3E8] flex justify-end">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#17202A] text-xs font-bold rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
