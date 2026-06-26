import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { logout } from '../firebase';
import { LogOut, Camera, Plus, History, ChevronDown, ChevronUp, QrCode } from 'lucide-react';
import PriorityBadge from './PriorityBadge';
import NotificationBell from './NotificationBell';
import AuditChainViewer from './AuditChainViewer';

const SLA_MATRIX: Record<string, string[]> = {
  'Civil':       ['Pipe Leak', 'Roof Seepage', 'Broken Door', 'Wall Crack', 'Floor Damage', 'Ceiling Damage', 'Plaster Falling', 'Compound Wall'],
  'Electrical':  ['Total Power Failure', 'Wiring Fault', 'Fan Not Working', 'Socket Dead', 'Meter Issue', 'MCB Tripping', 'Tube Light Fused', 'AC/Cooler Issue'],
  'Sanitary':    ['Drain Blocked', 'Sewage Overflow', 'Tap Broken', 'Flush Not Working', 'Water Supply Issue', 'Bathroom Tile Broken', 'Water Tank Leakage', 'Geyser Not Working'],
  'Carpentry':   ['Broken Window', 'Broken Door Frame', 'Wardrobe Damage', 'Staircase Railing', 'Roof Beam Damage', 'Cupboard Lock'],
  'Painting':    ['Wall Paint Peeling', 'Dampness / Fungus', 'Exterior Paint', 'Gate Painting'],
};

const STATUS_STEPS = ['Submitted', 'Seen', 'In-Progress', 'Resolved', 'Closed'];
const STATUS_ICONS: Record<string, string> = {
  'Submitted':       '📝',
  'Seen':            '👁️',
  'In-Progress':     '🔧',
  'Pending-Material':'⏳',
  'Resolved':        '✅',
  'Closed':          '🏁',
};

const STATUS_CSS: Record<string, string> = {
  'Submitted':       'badge-submitted',
  'Seen':            'badge-seen',
  'In-Progress':     'badge-in-progress',
  'Pending-Material':'badge-pending-mat',
  'Resolved':        'badge-resolved',
  'Closed':          'badge-closed',
};

function TicketTimeline({ status }: { status: string }) {
  const currentIdx = STATUS_STEPS.indexOf(status);
  return (
    <div style={{ padding: '12px 0' }}>
      {STATUS_STEPS.map((step, i) => {
        const isDone = i < currentIdx;
        const isActive = i === currentIdx || (status === 'Pending-Material' && step === 'In-Progress' && i === 2);
        return (
          <div key={step} className="timeline-step">
            <div className={`timeline-dot ${isDone ? 'timeline-dot-done' : isActive ? 'timeline-dot-active' : ''}`}>
              {isDone ? '✓' : STATUS_ICONS[step]}
            </div>
            <div style={{ paddingTop: 6 }}>
              <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: isDone || isActive ? 700 : 500, color: isDone || isActive ? '#1e293b' : '#94a3b8' }}>{step}</p>
              {status === 'Pending-Material' && step === 'In-Progress' && (
                <p style={{ margin: 0, fontSize: 11, color: '#f97316', fontWeight: 600 }}>⏳ Material procurement in progress</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function EmployeeDashboard({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [view, setView] = useState<'home' | 'raise' | 'history'>('home');
  const [showQR, setShowQR] = useState(false);
  const [form, setForm] = useState({ category: '', sub_category: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [auditTicketId, setAuditTicketId] = useState<number | null>(null);
  const [otpInput, setOtpInput] = useState<Record<number, string>>({});
  const [closingId, setClosingId] = useState<number | null>(null);
  const qrRef = useRef<any>(null);

  useEffect(() => { fetchTickets(); }, []);

  useEffect(() => {
    if (showQR) {
      const scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: 220 }, false);
      scanner.render((text: string) => {
        scanner.clear();
        setShowQR(false);
        try {
          const parsed = JSON.parse(text);
          if (parsed.quarter_no) setView('raise');
        } catch { setView('raise'); }
      }, () => {});
      qrRef.current = scanner;
      return () => { scanner.clear().catch(() => {}); };
    }
  }, [showQR]);

  const fetchTickets = async () => {
    const res = await fetch(`/api/tickets?role=Employee&pf_no=${user.pf_no}`);
    const data = await res.json();
    if (data.success) setTickets(data.tickets);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pf_no: user.pf_no, ...form }),
      });
      const data = await res.json();
      if (data.success) {
        setView('home');
        setForm({ category: '', sub_category: '', description: '' });
        fetchTickets();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = async (ticketId: number) => {
    const otp = otpInput[ticketId];
    if (!otp || otp.length < 4) return;
    setClosingId(ticketId);
    const res = await fetch(`/api/tickets/${ticketId}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp, pf_no: user.pf_no }),
    });
    const data = await res.json();
    setClosingId(null);
    if (data.success) fetchTickets();
    else alert(data.message);
  };

  const activeTickets = tickets.filter(t => t.status !== 'Closed');
  const closedTickets = tickets.filter(t => t.status === 'Closed');

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header className="bg-employee-header" style={{ padding: '12px 20px', boxShadow: '0 2px 10px rgba(26,86,219,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 600, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, background: 'rgba(255,255,255,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🚂</div>
            <div>
              <h1 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'white' }}>RailAwaas Care</h1>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>{user.name} · {user.quarter_type} {user.quarter_no}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NotificationBell userPf={user.pf_no} />
            <button onClick={() => { logout(); onLogout(); }} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', color: 'white', display: 'flex' }}>
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Nav Tabs */}
      <div style={{ background: 'white', borderBottom: '1px solid #f1f5f9', padding: '0 20px' }}>
        <div style={{ display: 'flex', maxWidth: 600, margin: '0 auto' }}>
          {[
            { id: 'home', label: '🏠 Home' },
            { id: 'raise', label: '➕ Raise' },
            { id: 'history', label: '📋 History' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setView(tab.id as any)} style={{
              flex: 1, padding: '12px 0', border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 13, fontWeight: view === tab.id ? 700 : 500,
              color: view === tab.id ? '#1a56db' : '#64748b',
              borderBottom: `2px solid ${view === tab.id ? '#1a56db' : 'transparent'}`,
              transition: 'all 0.2s',
            }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main style={{ flex: 1, padding: '16px 20px', maxWidth: 600, margin: '0 auto', width: '100%' }}>

        {/* HOME */}
        {view === 'home' && (
          <div className="animate-fade-in">
            {/* Quick Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                { icon: <Camera size={22} />, label: 'Scan QR', color: '#1a56db', bg: '#eff6ff', action: () => setShowQR(true) },
                { icon: <Plus size={22} />, label: 'New Request', color: '#10b981', bg: '#ecfdf5', action: () => setView('raise') },
                { icon: <History size={22} />, label: 'History', color: '#7c3aed', bg: '#f5f3ff', action: () => setView('history') },
              ].map(btn => (
                <button key={btn.label} onClick={btn.action} style={{
                  background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 8px',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)', transition: 'all 0.2s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: btn.bg, color: btn.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {btn.icon}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{btn.label}</span>
                </button>
              ))}
            </div>

            {showQR && (
              <div className="animate-scale-in" style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <QrCode size={16} color="#1a56db" />
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>Scan Quarter QR Code</span>
                  </div>
                  <button onClick={() => setShowQR(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, color: '#64748b' }}>Close</button>
                </div>
                <div id="qr-reader" style={{ borderRadius: 8, overflow: 'hidden' }} />
              </div>
            )}

            {/* Active Tickets */}
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
              Active Complaints ({activeTickets.length})
            </h3>
            {activeTickets.length === 0 ? (
              <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                <p style={{ margin: '0 0 4px', fontSize: 32 }}>✅</p>
                <p style={{ margin: 0, fontSize: 14 }}>No active complaints. All resolved!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {activeTickets.map(t => (
                  <div key={t.id} className="animate-fade-in-up" style={{
                    background: 'white', borderRadius: 16, border: '1px solid #e2e8f0',
                    borderLeft: `4px solid ${t.flag_color === 'Red' ? '#ef4444' : t.flag_color === 'Orange' ? '#f97316' : t.flag_color === 'Yellow' ? '#fbbf24' : '#1a56db'}`,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden',
                  }}>
                    <div style={{ padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>#{t.id} · {t.category}</span>
                            <PriorityBadge priority={t.priority} size="sm" />
                          </div>
                          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{t.sub_category} · {new Date(t.created_at).toLocaleDateString('en-IN')}</p>
                        </div>
                        <span className={`badge ${STATUS_CSS[t.status] || 'badge-submitted'}`}>{STATUS_ICONS[t.status]} {t.status}</span>
                      </div>
                      <p style={{ margin: '0 0 10px', fontSize: 12, color: '#475569', background: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>{t.description}</p>

                      {/* OTP Section */}
                      {t.status === 'Resolved' && t.closure_otp && (
                        <div className="otp-card" style={{ marginBottom: 12 }}>
                          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            🔑 Share this OTP with IOW to Close
                          </p>
                          <div className="otp-code">{t.closure_otp}</div>
                          <p style={{ margin: '8px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>Valid until ticket is closed · Do not share with others</p>
                        </div>
                      )}

                      {/* Expand toggle */}
                      <button onClick={() => setExpandedId(expandedId === t.id ? null : t.id)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, color: '#64748b', fontSize: 12,
                      }}>
                        {expandedId === t.id ? <><ChevronUp size={14} /> Hide Timeline & Audit</> : <><ChevronDown size={14} /> View Timeline & Audit Chain</>}
                      </button>
                    </div>

                    {expandedId === t.id && (
                      <div className="animate-fade-in" style={{ borderTop: '1px solid #f1f5f9', padding: '0 16px 16px' }}>
                        <TicketTimeline status={t.status} />
                        <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 8, paddingTop: 16 }}>
                          {auditTicketId === t.id ? (
                            <AuditChainViewer ticketId={t.id} onClose={() => setAuditTicketId(null)} />
                          ) : (
                            <button onClick={() => setAuditTicketId(t.id)} style={{
                              width: '100%', padding: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#1a56db', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6,
                            }}>
                              🔗 View Blockchain Audit Chain
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* RAISE COMPLAINT */}
        {view === 'raise' && (
          <div className="animate-fade-in">
            <div style={{ background: 'white', borderRadius: 20, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
              <div className="bg-employee-header" style={{ padding: '16px 20px' }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'white' }}>🛠️ Raise New Complaint</h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>SLA & Priority auto-assigned by category</p>
              </div>
              <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="rail-label">Category *</label>
                  <select required className="rail-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value, sub_category: '' })}>
                    <option value="">Select Department</option>
                    {Object.keys(SLA_MATRIX).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                {form.category && (
                  <div className="animate-fade-in">
                    <label className="rail-label">Issue Type *</label>
                    <select required className="rail-input" value={form.sub_category} onChange={e => setForm({ ...form, sub_category: e.target.value })}>
                      <option value="">Select Issue</option>
                      {SLA_MATRIX[form.category].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                )}
                {form.sub_category && (
                  <div className="animate-fade-in" style={{ background: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#1e40af' }}>
                    ℹ️ SLA & Priority will be auto-assigned based on your selection. IOWs cannot modify these values.
                  </div>
                )}
                <div>
                  <label className="rail-label">Description *</label>
                  <textarea required className="rail-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} placeholder="Describe the issue in detail..." style={{ resize: 'none' }} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" onClick={() => setView('home')} className="btn-ghost" style={{ flex: 1 }}>Cancel</button>
                  <button type="submit" disabled={submitting || !form.category || !form.sub_category || !form.description} className="btn-primary" style={{ flex: 2 }}>
                    {submitting ? '⏳ Submitting...' : '📤 Submit Complaint'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* HISTORY */}
        {view === 'history' && (
          <div className="animate-fade-in">
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Closed Tickets ({closedTickets.length})</h3>
            {closedTickets.length === 0 ? (
              <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                <p style={{ margin: 0, fontSize: 14 }}>No closed tickets yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {closedTickets.map(t => (
                  <div key={t.id} style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>#{t.id} · {t.category} — {t.sub_category}</span>
                      <span className="badge badge-closed">🏁 Closed</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#94a3b8' }}>
                      <span>Raised: {new Date(t.created_at).toLocaleDateString('en-IN')}</span>
                      {t.closed_at && <span>Closed: {new Date(t.closed_at).toLocaleDateString('en-IN')}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
