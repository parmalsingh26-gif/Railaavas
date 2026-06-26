import React, { useState, useEffect, useRef } from 'react';
import { LogOut, MapPin, Camera } from 'lucide-react';
import { logout } from '../firebase';
import PriorityBadge from './PriorityBadge';
import SLACountdown from './SLACountdown';
import NotificationBell from './NotificationBell';
import MaterialIndentModal from './MaterialIndentModal';
import AuditChainViewer from './AuditChainViewer';

const SLA_HOURS: Record<string, Record<string, number>> = {
  Civil: { 'Pipe Leak': 12, 'Roof Seepage': 48, 'Broken Door': 168, 'Wall Crack': 168, 'Floor Damage': 336, 'Ceiling Damage': 72, 'Plaster Falling': 48, 'Compound Wall': 504 },
  Electrical: { 'Total Power Failure': 6, 'Wiring Fault': 24, 'Fan Not Working': 72, 'Socket Dead': 72, 'Meter Issue': 48, 'MCB Tripping': 24, 'Tube Light Fused': 96, 'AC/Cooler Issue': 72 },
  Sanitary: { 'Drain Blocked': 12, 'Sewage Overflow': 6, 'Tap Broken': 24, 'Flush Not Working': 24, 'Water Supply Issue': 12, 'Bathroom Tile Broken': 336, 'Water Tank Leakage': 24, 'Geyser Not Working': 72 },
  Carpentry: { 'Broken Window': 120, 'Broken Door Frame': 168, 'Wardrobe Damage': 336, 'Staircase Railing': 72, 'Roof Beam Damage': 24, 'Cupboard Lock': 240 },
  Painting: { 'Wall Paint Peeling': 504, 'Dampness / Fungus': 168, 'Exterior Paint': 720, 'Gate Painting': 720 },
};

export default function IOWDashboard({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [otpInputs, setOtpInputs] = useState<Record<number, string[]>>({});
  const [holdModal, setHoldModal] = useState<any | null>(null);
  const [auditId, setAuditId] = useState<number | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    fetchTickets();
    navigator.geolocation.getCurrentPosition(
      pos => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => setGpsError('GPS unavailable: ' + err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const fetchTickets = async () => {
    const res = await fetch(`/api/tickets?role=IOW&iow_pf=${user.pf_no}`);
    const data = await res.json();
    if (data.success) setTickets(data.tickets);
  };

  const markStatus = async (id: number, endpoint: string) => {
    setProcessingId(id);
    await fetch(`/api/tickets/${id}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pf_no: user.pf_no }),
    });
    fetchTickets();
    setProcessingId(null);
  };

  const handleResolve = async (ticket: any) => {
    if (!location) { alert('GPS not acquired. Please enable location.'); return; }
    setProcessingId(ticket.id);
    const res = await fetch(`/api/tickets/${ticket.id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pf_no: user.pf_no, lat: location.lat, lng: location.lng, photoUrl: 'captured_photo_' + Date.now() }),
    });
    const data = await res.json();
    setProcessingId(null);
    if (data.success) { alert('✅ Marked Resolved! Employee will see OTP to confirm closure.'); fetchTickets(); }
    else alert('❌ ' + data.message);
  };

  const handleClose = async (ticketId: number) => {
    const digits = otpInputs[ticketId] || ['', '', '', ''];
    const otp = digits.join('');
    if (otp.length < 4) return;
    setProcessingId(ticketId);
    const res = await fetch(`/api/tickets/${ticketId}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp, pf_no: user.pf_no }),
    });
    const data = await res.json();
    setProcessingId(null);
    if (data.success) { alert('🏁 Ticket officially closed!'); fetchTickets(); }
    else alert('❌ ' + data.message);
  };

  const setOtpDigit = (ticketId: number, idx: number, val: string) => {
    const digits = [...(otpInputs[ticketId] || ['', '', '', ''])];
    digits[idx] = val.replace(/\D/g, '').slice(0, 1);
    setOtpInputs(prev => ({ ...prev, [ticketId]: digits }));
    // Auto-focus next
    if (val && idx < 3) {
      const next = document.getElementById(`otp-${ticketId}-${idx + 1}`);
      if (next) (next as HTMLInputElement).focus();
    }
  };

  const flagColors: Record<string, string> = { Red: '#ef4444', Orange: '#f97316', Yellow: '#fbbf24', None: '#e2e8f0' };

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header className="bg-iow-header" style={{ padding: '12px 20px', boxShadow: '0 2px 10px rgba(180,83,9,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🔧</div>
            <div>
              <h1 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'white' }}>IOW Workbench</h1>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>{user.name} · {user.designation || 'Inspector of Works'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NotificationBell userPf={user.pf_no} />
            <button onClick={() => { logout(); onLogout(); }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', color: 'white', display: 'flex' }}>
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* GPS Status Bar */}
      <div style={{ padding: '8px 16px', background: location ? '#ecfdf5' : '#fffbeb', borderBottom: '1px solid', borderColor: location ? '#a7f3d0' : '#fde68a', display: 'flex', alignItems: 'center', gap: 8 }}>
        <MapPin size={14} color={location ? '#059669' : '#d97706'} />
        <span style={{ fontSize: 12, fontWeight: 600, color: location ? '#065f46' : '#92400e' }}>
          {location ? `✅ GPS Active: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : gpsError || '⏳ Acquiring GPS...'}
        </span>
        {!location && !gpsError && (
          <div style={{ width: 12, height: 12, border: '2px solid #d97706', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin-slow 0.8s linear infinite', marginLeft: 'auto' }} />
        )}
      </div>

      {/* Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: '12px 16px' }}>
        {[
          { label: 'My Tasks', value: tickets.length, color: '#1a56db' },
          { label: 'Overdue', value: tickets.filter(t => new Date(t.SLA_deadline) < new Date()).length, color: '#dc2626' },
          { label: 'Resolved', value: tickets.filter(t => t.status === 'Resolved').length, color: '#10b981' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', borderRadius: 12, padding: '10px 12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</p>
            <p style={{ margin: 0, fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
          </div>
        ))}
      </div>

      <main style={{ flex: 1, padding: '0 16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {tickets.length === 0 && (
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            <p style={{ fontSize: 40, margin: '0 0 12px' }}>✅</p>
            <p style={{ margin: 0, fontSize: 14 }}>No tickets assigned to you. Check with your SSE.</p>
          </div>
        )}

        {tickets.map(t => {
          const slaHours = SLA_HOURS[t.category]?.[t.sub_category] ?? 48;
          const isProcessing = processingId === t.id;

          return (
            <div key={t.id} className="animate-fade-in-up" style={{
              background: 'white',
              borderRadius: 16,
              borderLeft: `5px solid ${flagColors[t.flag_color] || '#e2e8f0'}`,
              border: '1px solid #e2e8f0',
              boxShadow: t.flag_color === 'Red' ? '0 4px 16px rgba(239,68,68,0.15)' : t.flag_color === 'Orange' ? '0 4px 16px rgba(249,115,22,0.12)' : '0 1px 4px rgba(0,0,0,0.06)',
              overflow: 'hidden',
            }}>
              {/* Ticket Header */}
              <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: '#1e293b' }}>#{t.id}</span>
                      <PriorityBadge priority={t.priority} />
                      {t.flag_color !== 'None' && (
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: t.flag_color === 'Red' ? '#fef2f2' : t.flag_color === 'Orange' ? '#fff7ed' : '#fffbeb', color: t.flag_color === 'Red' ? '#dc2626' : t.flag_color === 'Orange' ? '#c2410c' : '#d97706' }}>
                          {t.flag_color === 'Red' ? '🔴' : t.flag_color === 'Orange' ? '🟠' : '🟡'} {t.flag_color}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#374151' }}>{t.category} → {t.sub_category}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>Employee: {t.pf_no}</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: '#f1f5f9', color: '#475569', height: 'fit-content' }}>{t.status}</span>
                </div>
                <p style={{ margin: '8px 0 10px', fontSize: 12, color: '#475569', background: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>{t.description}</p>

                {/* SLA Countdown */}
                {t.status !== 'Resolved' && t.status !== 'Closed' && (
                  <SLACountdown deadline={t.SLA_deadline} totalHours={slaHours} />
                )}
              </div>

              {/* Actions */}
              <div style={{ padding: '12px 16px', background: '#fafafa' }}>
                {t.status === 'Resolved' ? (
                  /* OTP Entry */
                  <div>
                    <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#1e293b' }}>🔑 Enter OTP from Employee to Close</p>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 10 }}>
                      {[0, 1, 2, 3].map(i => (
                        <input
                          key={i}
                          id={`otp-${t.id}-${i}`}
                          className="otp-input-box"
                          maxLength={1}
                          value={(otpInputs[t.id] || ['', '', '', ''])[i]}
                          onChange={e => setOtpDigit(t.id, i, e.target.value)}
                          onKeyDown={e => { if (e.key === 'Backspace' && !((otpInputs[t.id] || [])[i]) && i > 0) { document.getElementById(`otp-${t.id}-${i - 1}`)?.focus(); } }}
                        />
                      ))}
                    </div>
                    <button onClick={() => handleClose(t.id)} disabled={isProcessing || (otpInputs[t.id] || []).join('').length < 4} className="btn-success" style={{ width: '100%' }}>
                      {isProcessing ? '⏳ Verifying...' : '🏁 Verify OTP & Close Ticket'}
                    </button>
                  </div>
                ) : t.status === 'Submitted' || t.status === 'Seen' ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {t.status === 'Submitted' && (
                      <button onClick={() => markStatus(t.id, 'seen')} disabled={isProcessing} className="btn-ghost" style={{ flex: 1, minWidth: 120, fontSize: 12 }}>
                        👁️ Mark Seen
                      </button>
                    )}
                    <button onClick={() => markStatus(t.id, 'inprogress')} disabled={isProcessing} className="btn-amber" style={{ flex: 1, minWidth: 120, fontSize: 12 }}>
                      🔧 Start Work
                    </button>
                  </div>
                ) : t.status === 'In-Progress' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* Camera / Geo-Resolve */}
                    <div style={{ position: 'relative' }}>
                      <input
                        type="file" accept="image/*" capture="environment"
                        id={`cam-${t.id}`}
                        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                        onChange={() => handleResolve(t)}
                      />
                      <label htmlFor={`cam-${t.id}`} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        padding: '11px 16px', background: 'linear-gradient(135deg, #059669, #10b981)',
                        color: 'white', borderRadius: 12, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                        boxShadow: '0 4px 12px rgba(16,185,129,0.35)', transition: 'all 0.2s',
                      }}>
                        <Camera size={16} /> 📍 Geo-Resolve (Take Photo)
                      </label>
                    </div>
                    <button onClick={() => setHoldModal(t)} className="btn-ghost" style={{ fontSize: 13 }}>
                      ⏳ Mark Pending-Material
                    </button>
                    <button onClick={() => setAuditId(auditId === t.id ? null : t.id)} style={{ background: 'none', border: '1px dashed #e2e8f0', borderRadius: 10, padding: '8px', cursor: 'pointer', fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
                      🔗 {auditId === t.id ? 'Hide' : 'View'} Audit Chain
                    </button>
                  </div>
                ) : t.status === 'Pending-Material' ? (
                  <div style={{ background: '#fff7ed', borderRadius: 10, padding: '10px 14px', border: '1px solid #fed7aa' }}>
                    <p style={{ margin: '0 0 3px', fontSize: 12, fontWeight: 700, color: '#92400e' }}>⏳ Pending Material</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#b45309' }}>{t.hold_reason || 'Material indent submitted to SSE'}</p>
                  </div>
                ) : null}

                {auditId === t.id && (
                  <div className="animate-fade-in" style={{ marginTop: 10, border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                    <AuditChainViewer ticketId={t.id} onClose={() => setAuditId(null)} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </main>

      {/* Material Indent Modal */}
      {holdModal && (
        <MaterialIndentModal
          ticketId={holdModal.id}
          ticket={holdModal}
          iow={user}
          onClose={() => setHoldModal(null)}
          onSuccess={() => { setHoldModal(null); fetchTickets(); }}
        />
      )}
    </div>
  );
}
