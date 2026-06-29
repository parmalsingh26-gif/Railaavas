import React, { useState, useEffect, useRef } from 'react';
import { LogOut, MapPin, Camera, Calendar, Navigation, Clock, TrendingUp, Star, Filter, ChevronDown, ChevronUp, Search } from 'lucide-react';
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

function ScheduleVisitModal({ ticketId, iowPf, onClose, onSuccess }: { ticketId: string; iowPf: string; onClose: () => void; onSuccess: () => void }) {
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const slots = ['08:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00', '16:00-18:00'];

  const submit = async () => {
    if (!date || !timeSlot) return;
    setLoading(true);
    await fetch(`/api/tickets/${ticketId}/visit-schedule`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ iow_pf: iowPf, scheduled_at: date, time_slot: timeSlot, notes, created_by: iowPf }),
    });
    setLoading(false);
    onSuccess();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 380 }}>
        <div style={{ background: 'linear-gradient(135deg, #b45309, #d97706)', padding: '16px 20px', color: 'white', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>📅 Schedule Visit</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, opacity: 0.85 }}>Set when you'll visit this quarter</p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'white' }}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="rail-label">Visit Date *</label>
            <input type="date" className="rail-input" value={date} onChange={e => setDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
          </div>
          <div>
            <label className="rail-label">Time Slot *</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {slots.map(s => (
                <button key={s} onClick={() => setTimeSlot(s)} style={{
                  padding: '8px', border: `1.5px solid ${timeSlot === s ? '#d97706' : '#e2e8f0'}`,
                  borderRadius: 8, background: timeSlot === s ? '#fffbeb' : 'white',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  color: timeSlot === s ? '#b45309' : '#64748b',
                }}>{s}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="rail-label">Notes (optional)</label>
            <input className="rail-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any special instructions..." />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} className="btn-ghost" style={{ flex: 1 }}>Cancel</button>
            <button onClick={submit} disabled={loading || !date || !timeSlot} className="btn-amber" style={{ flex: 2 }}>
              {loading ? 'Scheduling...' : '📅 Confirm Schedule'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CostEstimateModal({ ticketId, iowPf, onClose, onSuccess }: { ticketId: string; iowPf: string; onClose: () => void; onSuccess: () => void }) {
  const [cost, setCost] = useState('');
  const [contractor, setContractor] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!cost) return;
    setLoading(true);
    await fetch(`/api/tickets/${ticketId}/cost-estimate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estimated_cost: cost, contractor_name: contractor, pf_no: iowPf }),
    });
    setLoading(false);
    onSuccess();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 360 }}>
        <div style={{ background: 'linear-gradient(135deg, #059669, #10b981)', padding: '16px 20px', color: 'white', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>💰 Cost Estimate</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, opacity: 0.85 }}>Submit estimated cost for this work</p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'white' }}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="rail-label">Estimated Cost (₹) *</label>
            <input type="number" className="rail-input" value={cost} onChange={e => setCost(e.target.value)} placeholder="e.g. 2500" />
          </div>
          <div>
            <label className="rail-label">Contractor Name (if applicable)</label>
            <input className="rail-input" value={contractor} onChange={e => setContractor(e.target.value)} placeholder="Contractor name" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} className="btn-ghost" style={{ flex: 1 }}>Cancel</button>
            <button onClick={submit} disabled={loading || !cost} className="btn-success" style={{ flex: 2 }}>
              {loading ? 'Submitting...' : '💰 Submit Estimate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IOWDashboard({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [upcomingVisits, setUpcomingVisits] = useState<any[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [otpInputs, setOtpInputs] = useState<Record<string, string[]>>({});
  const [holdModal, setHoldModal] = useState<any | null>(null);
  const [auditId, setAuditId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tickets' | 'calendar' | 'stats'>('tickets');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [searchQ, setSearchQ] = useState('');
  const [sortByProximity, setSortByProximity] = useState(false);
  const [scheduleModal, setScheduleModal] = useState<string | null>(null);
  const [costModal, setCostModal] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchTickets();
    fetchVisits();
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

  const fetchVisits = async () => {
    const res = await fetch(`/api/dashboard/iow/${user.pf_no}/schedule`);
    const data = await res.json();
    if (data.success) setUpcomingVisits(data.schedules);
  };

  const markStatus = async (id: string, endpoint: string) => {
    setProcessingId(id);
    await fetch(`/api/tickets/${id}/${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pf_no: user.pf_no }),
    });
    fetchTickets();
    setProcessingId(null);
  };

  const handleResolve = async (ticket: any) => {
    if (!location) { alert('GPS not acquired. Please enable location.'); return; }
    setProcessingId(ticket.id);
    const res = await fetch(`/api/tickets/${ticket.id}/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pf_no: user.pf_no, lat: location.lat, lng: location.lng, photoUrl: 'captured_photo_' + Date.now() }),
    });
    const data = await res.json();
    setProcessingId(null);
    if (data.success) { fetchTickets(); }
    else alert('❌ ' + data.message);
  };

  const handleClose = async (ticketId: string) => {
    const digits = otpInputs[ticketId] || ['', '', '', ''];
    const otp = digits.join('');
    if (otp.length < 4) return;
    setProcessingId(ticketId);
    const res = await fetch(`/api/tickets/${ticketId}/close`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp, pf_no: user.pf_no }),
    });
    const data = await res.json();
    setProcessingId(null);
    if (data.success) { fetchTickets(); }
    else alert('❌ ' + data.message);
  };

  const setOtpDigit = (ticketId: string, idx: number, val: string) => {
    const digits = [...(otpInputs[ticketId] || ['', '', '', ''])];
    digits[idx] = val.replace(/\D/g, '').slice(0, 1);
    setOtpInputs(prev => ({ ...prev, [ticketId]: digits }));
    if (val && idx < 3) { const next = document.getElementById(`otp-${ticketId}-${idx + 1}`); if (next) (next as HTMLInputElement).focus(); }
  };

  const openInMaps = (lat?: number | null, lng?: number | null) => {
    if (!lat || !lng) return;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  const flagColors: Record<string, string> = { Red: '#ef4444', Orange: '#f97316', Yellow: '#fbbf24', None: '#e2e8f0' };

  // Filtered + sorted tickets
  let displayTickets = tickets;
  if (filterCategory !== 'All') displayTickets = displayTickets.filter(t => t.category === filterCategory);
  if (filterPriority !== 'All') displayTickets = displayTickets.filter(t => t.priority === filterPriority);
  if (searchQ) displayTickets = displayTickets.filter(t =>
    (t.user?.name || '').toLowerCase().includes(searchQ.toLowerCase()) ||
    t.category.toLowerCase().includes(searchQ.toLowerCase()) ||
    t.sub_category.toLowerCase().includes(searchQ.toLowerCase()) ||
    t.pf_no.includes(searchQ)
  );

  // Sort: Critical → Red flag → SLA breach → others
  displayTickets = [...displayTickets].sort((a, b) => {
    const priorityOrder = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    const aOverdue = new Date(a.SLA_deadline) < new Date() ? 1 : 0;
    const bOverdue = new Date(b.SLA_deadline) < new Date() ? 1 : 0;
    if (aOverdue !== bOverdue) return bOverdue - aOverdue;
    const aFlag = a.flag_color === 'Red' ? 3 : a.flag_color === 'Orange' ? 2 : a.flag_color === 'Yellow' ? 1 : 0;
    const bFlag = b.flag_color === 'Red' ? 3 : b.flag_color === 'Orange' ? 2 : b.flag_color === 'Yellow' ? 1 : 0;
    if (aFlag !== bFlag) return bFlag - aFlag;
    return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
  });

  const overdueCount = tickets.filter(t => new Date(t.SLA_deadline) < new Date()).length;
  const resolvedCount = tickets.filter(t => t.status === 'Resolved').length;
  const doneToday = tickets.filter(t => t.status === 'Closed' && t.closed_at && new Date(t.closed_at).toDateString() === new Date().toDateString()).length;

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', flexDirection: 'column', maxWidth: 680, margin: '0 auto' }}>
      {/* Header */}
      <header className="bg-iow-header" style={{ padding: '12px 20px', boxShadow: '0 2px 10px rgba(180,83,9,0.3)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🔧</div>
            <div>
              <h1 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'white' }}>IOW Workbench</h1>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>{user.name} · {user.unique_code || user.pf_no}</p>
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
          {location ? `✅ GPS Active: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : gpsError || '⏳ Acquiring GPS...'}
        </span>
        {!location && !gpsError && <div style={{ width: 12, height: 12, border: '2px solid #d97706', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin-slow 0.8s linear infinite', marginLeft: 'auto' }} />}
      </div>

      {/* Stats Strip */}
      <div className="stats-strip" style={{ padding: '12px 16px 4px' }}>
        {[
          { label: 'My Tasks', value: tickets.length, color: '#1a56db' },
          { label: 'Overdue', value: overdueCount, color: '#dc2626' },
          { label: 'Resolved', value: resolvedCount, color: '#10b981' },
          { label: 'Done Today', value: doneToday, color: '#7c3aed' },
          { label: 'Visits Scheduled', value: upcomingVisits.length, color: '#d97706' },
          { label: 'Avg Rating', value: user.average_rating ? `${user.average_rating}⭐` : '—', color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="stats-strip-item">
            <p style={{ margin: '0 0 2px', fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</p>
            <p style={{ margin: 0, fontSize: 9, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ padding: '8px 16px 0', background: '#f9fafb', borderBottom: '1px solid #f1f5f9' }}>
        <div className="tab-switcher">
          {(['tickets', 'calendar', 'stats'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={`tab-btn ${activeTab === t ? 'tab-btn-active' : ''}`}>
              {t === 'tickets' ? `🔧 Tasks (${displayTickets.length})` : t === 'calendar' ? `📅 Visits (${upcomingVisits.length})` : '📊 My Stats'}
            </button>
          ))}
        </div>
      </div>

      <main style={{ flex: 1, padding: '12px 16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* TICKETS TAB */}
        {activeTab === 'tickets' && (
          <>
            {/* Filters */}
            <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '10px 12px' }}>
              <div className="search-input-wrap" style={{ marginBottom: 8 }}>
                <Search size={13} className="search-icon" />
                <input className="rail-input" style={{ paddingLeft: 34, fontSize: 12 }} placeholder="Search by employee name, PF, category..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
              </div>
              <div className="filter-pills">
                {['All', 'Civil', 'Electrical', 'Sanitary', 'Carpentry', 'Painting'].map(c => (
                  <button key={c} onClick={() => setFilterCategory(c)} className={`filter-pill ${filterCategory === c ? 'filter-pill-active' : ''}`}>{c}</button>
                ))}
              </div>
              <div className="filter-pills" style={{ marginTop: 6 }}>
                {['All', 'Critical', 'High', 'Medium', 'Low'].map(p => (
                  <button key={p} onClick={() => setFilterPriority(p)} className={`filter-pill ${filterPriority === p ? (p === 'Critical' ? 'filter-pill-red-active' : p === 'High' ? 'filter-pill-amber-active' : 'filter-pill-active') : ''}`}>{p}</button>
                ))}
              </div>
            </div>

            {displayTickets.length === 0 ? (
              <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                <p style={{ fontSize: 40, margin: '0 0 12px' }}>✅</p>
                <p style={{ margin: 0, fontSize: 14 }}>{tickets.length === 0 ? 'No tickets assigned. Check with your SSE.' : 'No tickets match filter.'}</p>
              </div>
            ) : (
              displayTickets.map(t => {
                const slaHours = SLA_HOURS[t.category]?.[t.sub_category] ?? 48;
                const isProcessing = processingId === t.id;
                const isOverdue = new Date(t.SLA_deadline) < new Date();

                return (
                  <div key={t.id} className="animate-fade-in-up" style={{
                    background: 'white', borderRadius: 16,
                    borderLeft: `5px solid ${flagColors[t.flag_color] || '#e2e8f0'}`,
                    border: '1px solid #e2e8f0',
                    boxShadow: t.flag_color === 'Red' ? '0 4px 16px rgba(239,68,68,0.15)' : t.urgency_escalated ? '0 4px 16px rgba(239,68,68,0.1)' : '0 1px 4px rgba(0,0,0,0.06)',
                    overflow: 'hidden',
                  }}>
                    {/* Urgency banner */}
                    {t.urgency_escalated && (
                      <div style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '6px 14px' }}>
                        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#dc2626' }}>🆘 Employee escalated: "STILL NOT RESOLVED" — Immediate action required!</p>
                      </div>
                    )}

                    <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #f8fafc' }}>
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontWeight: 800, fontSize: 14, color: '#1e293b' }}>#{t.id.slice(-6)}</span>
                            <PriorityBadge priority={t.priority} />
                            {t.flag_color !== 'None' && (
                              <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: t.flag_color === 'Red' ? '#fef2f2' : '#fff7ed', color: t.flag_color === 'Red' ? '#dc2626' : '#c2410c' }}>
                                {t.flag_color === 'Red' ? '🔴' : t.flag_color === 'Orange' ? '🟠' : '🟡'} {t.flag_color}
                              </span>
                            )}
                            {isOverdue && <span style={{ fontSize: 9, fontWeight: 800, color: '#dc2626', background: '#fef2f2', padding: '2px 6px', borderRadius: 4 }}>OVERDUE</span>}
                          </div>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#374151' }}>{t.category} → {t.sub_category}</p>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: '#f1f5f9', color: '#475569', height: 'fit-content', whiteSpace: 'nowrap' }}>{t.status}</span>
                      </div>

                      {/* Employee Info — Name + PF + Code */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#eff6ff', borderRadius: 8, marginBottom: 8, border: '1px solid #bfdbfe' }}>
                        <div style={{ width: 28, height: 28, background: '#1a56db', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, flexShrink: 0 }}>👤</div>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1e40af' }}>{t.user?.name || 'Unknown Employee'}</p>
                          <p style={{ margin: 0, fontSize: 10, color: '#3b82f6' }}>PF: {t.pf_no} · {t.user?.unique_code || ''} · {t.user?.quarter_type} {t.user?.quarter_no}</p>
                        </div>
                        {t.user?.quarter_gps_lat && (
                          <button onClick={() => openInMaps(t.user.quarter_gps_lat, t.user.quarter_gps_lng)} style={{ background: '#1a56db', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'white', fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Navigation size={10} /> Navigate
                          </button>
                        )}
                      </div>

                      <p style={{ margin: '0 0 8px', fontSize: 12, color: '#475569', background: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>{t.description}</p>

                      {/* Visit scheduled indicator */}
                      {t.visit_scheduled_at && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: '#ecfdf5', borderRadius: 6, border: '1px solid #a7f3d0', marginBottom: 8 }}>
                          <Calendar size={12} color="#059669" />
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#065f46' }}>Visit: {new Date(t.visit_scheduled_at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} {t.visit_notes && `· ${t.visit_notes}`}</span>
                        </div>
                      )}

                      {/* Cost estimate indicator */}
                      {t.estimated_cost && (
                        <div style={{ fontSize: 11, color: '#059669', fontWeight: 600, marginBottom: 6 }}>
                          💰 Estimated Cost: ₹{t.estimated_cost.toLocaleString('en-IN')}
                          {t.contractor_name && ` | Contractor: ${t.contractor_name}`}
                        </div>
                      )}

                      {/* SLA Countdown */}
                      {t.status !== 'Resolved' && t.status !== 'Closed' && (
                        <SLACountdown deadline={t.SLA_deadline} totalHours={slaHours} />
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ padding: '12px 16px', background: '#fafafa' }}>
                      {t.status === 'Resolved' ? (
                        <div>
                          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#1e293b' }}>🔑 Enter OTP from Employee to Close</p>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 10 }}>
                            {[0, 1, 2, 3].map(i => (
                              <input key={i} id={`otp-${t.id}-${i}`} className="otp-input-box" maxLength={1}
                                value={(otpInputs[t.id] || ['', '', '', ''])[i]}
                                onChange={e => setOtpDigit(t.id, i, e.target.value)}
                                onKeyDown={e => { if (e.key === 'Backspace' && !((otpInputs[t.id] || [])[i]) && i > 0) document.getElementById(`otp-${t.id}-${i - 1}`)?.focus(); }}
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
                            <button onClick={() => markStatus(t.id, 'seen')} disabled={isProcessing} className="btn-ghost" style={{ flex: 1, minWidth: 100, fontSize: 12 }}>👁️ Mark Seen</button>
                          )}
                          <button onClick={() => markStatus(t.id, 'inprogress')} disabled={isProcessing} className="btn-amber" style={{ flex: 1, minWidth: 100, fontSize: 12 }}>🔧 Start Work</button>
                          <button onClick={() => setScheduleModal(t.id)} style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: '10px 14px', cursor: 'pointer', fontSize: 12, color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Calendar size={13} /> Schedule
                          </button>
                        </div>
                      ) : t.status === 'In-Progress' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <div style={{ position: 'relative', flex: 2 }}>
                              <input type="file" accept="image/*" capture="environment" id={`cam-${t.id}`}
                                style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                                onChange={() => handleResolve(t)} />
                              <label htmlFor={`cam-${t.id}`} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                padding: '11px 16px', background: 'linear-gradient(135deg, #059669, #10b981)',
                                color: 'white', borderRadius: 12, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                                boxShadow: '0 4px 12px rgba(16,185,129,0.35)',
                              }}>
                                <Camera size={16} /> 📍 Geo-Resolve
                              </label>
                            </div>
                            <button onClick={() => setCostModal(t.id)} style={{ flex: 1, background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: '10px', cursor: 'pointer', fontSize: 12, color: '#059669', fontWeight: 600 }}>💰 Cost</button>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => setHoldModal(t)} className="btn-ghost" style={{ flex: 1, fontSize: 12 }}>⏳ Pending Material</button>
                            <button onClick={() => setScheduleModal(t.id)} style={{ flex: 1, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: '10px', cursor: 'pointer', fontSize: 12, color: '#d97706', fontWeight: 600 }}>📅 Schedule</button>
                          </div>
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
              })
            )}
          </>
        )}

        {/* CALENDAR TAB */}
        {activeTab === 'calendar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '14px 16px' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>📅 Upcoming Visit Schedule</h3>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Your scheduled site visits in chronological order</p>
            </div>
            {upcomingVisits.length === 0 ? (
              <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                <Calendar size={32} style={{ opacity: 0.3, marginBottom: 10 }} />
                <p style={{ margin: 0, fontSize: 14 }}>No visits scheduled yet.</p>
              </div>
            ) : (
              upcomingVisits.map((v, i) => (
                <div key={v.id} className="animate-fade-in-up visit-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div>
                      <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 800, color: '#065f46' }}>
                        {new Date(v.scheduled_at).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: '#059669', fontWeight: 600 }}>⏰ {v.time_slot}</p>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#059669', background: '#d1fae5', padding: '3px 8px', borderRadius: 999, height: 'fit-content' }}>SCHEDULED</span>
                  </div>
                  <div style={{ padding: '8px 10px', background: 'rgba(5,150,105,0.08)', borderRadius: 8 }}>
                    <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 700, color: '#065f46' }}>
                      🏠 {v.ticket?.user?.quarter_type} {v.ticket?.user?.quarter_no}
                    </p>
                    <p style={{ margin: '0 0 2px', fontSize: 11, color: '#059669' }}>
                      👤 {v.ticket?.user?.name} (PF: {v.ticket?.pf_no})
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: '#059669' }}>
                      🔧 {v.ticket?.category} — {v.ticket?.sub_category}
                    </p>
                    {v.notes && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>Note: {v.notes}</p>}
                  </div>
                  {v.ticket?.user?.quarter_gps_lat && (
                    <button onClick={() => openInMaps(v.ticket.user.quarter_gps_lat, v.ticket.user.quarter_gps_lng)} style={{ marginTop: 8, background: '#059669', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: 'white', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Navigation size={12} /> Open in Maps
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* STATS TAB */}
        {activeTab === 'stats' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: '18px 20px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>📊 My Performance</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Total Assigned', value: tickets.length, color: '#1a56db', bg: '#eff6ff' },
                  { label: 'Resolved', value: resolvedCount, color: '#059669', bg: '#ecfdf5' },
                  { label: 'Overdue', value: overdueCount, color: '#dc2626', bg: '#fef2f2' },
                  { label: 'Avg Rating', value: user.average_rating ? `${user.average_rating} ⭐` : 'No ratings yet', color: '#f59e0b', bg: '#fffbeb' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: '14px', border: '1px solid transparent' }}>
                    <p style={{ margin: '0 0 4px', fontSize: 11, color: s.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
                    <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: '18px 20px' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>📋 Work by Category</h3>
              {Object.entries(tickets.reduce((acc: Record<string, number>, t) => { acc[t.category] = (acc[t.category] || 0) + 1; return acc; }, {})).map(([cat, count]) => {
                const pct = (count as number / tickets.length) * 100;
                return (
                  <div key={cat} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                      <span style={{ fontWeight: 600, color: '#374151' }}>{cat}</span>
                      <span style={{ color: '#64748b' }}>{count} tickets ({Math.round(pct)}%)</span>
                    </div>
                    <div style={{ height: 8, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: cat === 'Civil' ? '#3b82f6' : cat === 'Electrical' ? '#f59e0b' : cat === 'Sanitary' ? '#10b981' : cat === 'Carpentry' ? '#8b5cf6' : '#ec4899', borderRadius: 999, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: '18px 20px' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>🔑 Your Identity</h3>
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>RailAwaas Code</p>
                <p style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 900, color: '#1a56db', fontFamily: 'monospace', letterSpacing: 3 }}>{user.unique_code || 'Not assigned'}</p>
                <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>PF: {user.pf_no} · {user.designation || 'IOW'} · {user.hq}</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {holdModal && (
        <MaterialIndentModal ticketId={holdModal.id} ticket={holdModal} iow={user} onClose={() => setHoldModal(null)} onSuccess={() => { setHoldModal(null); fetchTickets(); }} />
      )}
      {scheduleModal && (
        <ScheduleVisitModal ticketId={scheduleModal} iowPf={user.pf_no} onClose={() => setScheduleModal(null)} onSuccess={() => { setScheduleModal(null); fetchTickets(); fetchVisits(); }} />
      )}
      {costModal && (
        <CostEstimateModal ticketId={costModal} iowPf={user.pf_no} onClose={() => setCostModal(null)} onSuccess={() => { setCostModal(null); fetchTickets(); }} />
      )}
    </div>
  );
}
