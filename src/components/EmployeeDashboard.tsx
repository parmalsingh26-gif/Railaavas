import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { logout } from '../firebase';
import { LogOut, Camera, Plus, History, ChevronDown, ChevronUp, QrCode, Star, Bell, Home, AlertTriangle, RotateCcw, Download, MapPin, Filter, Search, Copy, Check } from 'lucide-react';
import PriorityBadge from './PriorityBadge';
import NotificationBell from './NotificationBell';
import AuditChainViewer from './AuditChainViewer';
import EditProfileModal from './EditProfileModal';

const SLA_MATRIX: Record<string, string[]> = {
  'Civil':       ['Pipe Leak', 'Roof Seepage', 'Broken Door', 'Wall Crack', 'Floor Damage', 'Ceiling Damage', 'Plaster Falling', 'Compound Wall'],
  'Electrical':  ['Total Power Failure', 'Wiring Fault', 'Fan Not Working', 'Socket Dead', 'Meter Issue', 'MCB Tripping', 'Tube Light Fused', 'AC/Cooler Issue'],
  'Sanitary':    ['Drain Blocked', 'Sewage Overflow', 'Tap Broken', 'Flush Not Working', 'Water Supply Issue', 'Bathroom Tile Broken', 'Water Tank Leakage', 'Geyser Not Working'],
  'Carpentry':   ['Broken Window', 'Broken Door Frame', 'Wardrobe Damage', 'Staircase Railing', 'Roof Beam Damage', 'Cupboard Lock'],
  'Painting':    ['Wall Paint Peeling', 'Dampness / Fungus', 'Exterior Paint', 'Gate Painting'],
};

const STATUS_STEPS = ['Submitted', 'Seen', 'In-Progress', 'Resolved', 'Closed'];
const STATUS_ICONS: Record<string, string> = {
  'Submitted': '📝', 'Seen': '👁️', 'In-Progress': '🔧',
  'Pending-Material': '⏳', 'Resolved': '✅', 'Closed': '🏁',
};
const STATUS_CSS: Record<string, string> = {
  'Submitted': 'badge-submitted', 'Seen': 'badge-seen', 'In-Progress': 'badge-in-progress',
  'Pending-Material': 'badge-pending-mat', 'Resolved': 'badge-resolved', 'Closed': 'badge-closed',
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

function SLABar({ deadline }: { deadline: string }) {
  const now = Date.now();
  const slaTime = new Date(deadline).getTime();
  const created = slaTime - 48 * 3600 * 1000; // Approximate
  const total = slaTime - created;
  const elapsed = now - created;
  const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
  const isOverdue = now > slaTime;
  const hoursLeft = Math.abs(slaTime - now) / 3600000;
  const color = isOverdue ? '#ef4444' : pct > 75 ? '#f97316' : pct > 50 ? '#f59e0b' : '#10b981';
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
        <span style={{ color: '#94a3b8', fontWeight: 600 }}>SLA Progress</span>
        <span style={{ color, fontWeight: 700 }}>
          {isOverdue ? `🔴 ${Math.round(hoursLeft)}h overdue` : `${Math.round(hoursLeft)}h remaining`}
        </span>
      </div>
      <div className="sla-progress-track">
        <div className={`sla-progress-fill ${isOverdue ? 'sla-fill-red' : pct > 75 ? 'sla-fill-red' : pct > 50 ? 'sla-fill-yellow' : 'sla-fill-green'}`}
          style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="star-rating" style={{ justifyContent: 'center' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} className="star-btn"
          onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(i)}>
          <span className={i <= (hovered || value) ? 'star-filled' : 'star-empty'}>★</span>
        </button>
      ))}
    </div>
  );
}

export default function EmployeeDashboard({ user: initialUser, onLogout }: { user: any; onLogout: () => void }) {
  const [user, setUser] = useState(initialUser);
  const [tickets, setTickets] = useState<any[]>([]);
  const [view, setView] = useState<'home' | 'raise' | 'history' | 'notifications'>('home');
  const [showQR, setShowQR] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const [form, setForm] = useState({ category: '', sub_categories: [] as string[], custom_issue: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [auditTicketId, setAuditTicketId] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState<Record<string, string>>({});
  const [closingId, setClosingId] = useState<string | null>(null);

  // Feature states
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [searchQ, setSearchQ] = useState('');
  const [ratingModal, setRatingModal] = useState<any | null>(null);
  const [ratingVal, setRatingVal] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [escalatingId, setEscalatingId] = useState<string | null>(null);
  const [reopenModal, setReopenModal] = useState<any | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const qrRef = useRef<any>(null);

  useEffect(() => { fetchTickets(); fetchNotifications(); }, []);

  useEffect(() => {
    if (showQR) {
      const scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: 220 }, false);
      scanner.render((text: string) => {
        scanner.clear();
        setShowQR(false);
        try {
          const parsed = JSON.parse(text);
          if (parsed.quarter_no) {
            setForm(f => ({ ...f, category: parsed.category || '' }));
            setView('raise');
          }
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

  const fetchNotifications = async () => {
    const res = await fetch(`/api/notifications/${user.pf_no}`);
    const data = await res.json();
    if (data.success) setNotifications(data.notifications);
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
        setForm({ category: '', sub_categories: [], custom_issue: '', description: '' });
        fetchTickets();
      }
    } finally { setSubmitting(false); }
  };

  const handleClose = async (ticketId: string) => {
    const otp = otpInput[ticketId];
    if (!otp || otp.length < 4) return;
    setClosingId(ticketId);
    const res = await fetch(`/api/tickets/${ticketId}/close`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp, pf_no: user.pf_no }),
    });
    const data = await res.json();
    setClosingId(null);
    if (data.success) { fetchTickets(); }
    else alert(data.message);
  };

  const escalateUrgency = async (ticketId: string) => {
    if (!confirm('Are you sure you want to escalate this ticket? This notifies SSE and IOW immediately.')) return;
    setEscalatingId(ticketId);
    await fetch(`/api/tickets/${ticketId}/escalate-urgency`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pf_no: user.pf_no }),
    });
    setEscalatingId(null);
    fetchTickets();
    alert('🆘 Urgency escalated! SSE and IOW have been notified.');
  };

  const submitRating = async () => {
    if (!ratingVal || !ratingModal) return;
    setRatingSubmitting(true);
    await fetch(`/api/tickets/${ratingModal.id}/rate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: ratingVal, rating_comment: ratingComment, pf_no: user.pf_no }),
    });
    setRatingSubmitting(false);
    setRatingModal(null);
    setRatingVal(0);
    setRatingComment('');
    fetchTickets();
  };

  const submitReopen = async () => {
    if (!reopenReason.trim() || !reopenModal) return;
    const res = await fetch(`/api/tickets/${reopenModal.id}/reopen`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pf_no: user.pf_no, reason: reopenReason }),
    });
    const data = await res.json();
    if (data.success) { setReopenModal(null); setReopenReason(''); fetchTickets(); }
    else alert(data.message);
  };

  const copyCode = () => {
    if (user.unique_code) { navigator.clipboard.writeText(user.unique_code); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); }
  };

  const downloadMyReport = () => {
    const rows = tickets.map(t =>
      `#${t.id} | ${t.category} - ${t.sub_category} | ${t.status} | ${t.priority} | SLA: ${new Date(t.SLA_deadline).toLocaleDateString('en-IN')} | Raised: ${new Date(t.created_at).toLocaleDateString('en-IN')}`
    ).join('\n');
    const content = `RailAwaas Care — My Complaint History\n${user.name} (PF: ${user.pf_no}) | Code: ${user.unique_code}\nGenerated: ${new Date().toLocaleString('en-IN')}\n\n${'─'.repeat(80)}\n${rows || 'No tickets found.'}\n${'─'.repeat(80)}\nTotal: ${tickets.length} | Active: ${activeTickets.length} | Closed: ${closedTickets.length}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `MyComplaints_${user.pf_no}.txt`; a.click();
  };

  // Filtered tickets
  let displayTickets = tickets;
  if (filterStatus !== 'All') displayTickets = displayTickets.filter(t => t.status === filterStatus);
  if (filterCategory !== 'All') displayTickets = displayTickets.filter(t => t.category === filterCategory);
  if (searchQ) displayTickets = displayTickets.filter(t => t.sub_category.toLowerCase().includes(searchQ.toLowerCase()) || t.description.toLowerCase().includes(searchQ.toLowerCase()) || t.id.includes(searchQ));

  const activeTickets = tickets.filter(t => t.status !== 'Closed');
  const closedTickets = tickets.filter(t => t.status === 'Closed');
  const overdueTickets = tickets.filter(t => new Date(t.SLA_deadline) < new Date() && t.status !== 'Closed');
  const unreadNotifs = notifications.filter(n => !n.is_read).length;

  const flagColor = (t: any) => t.flag_color === 'Red' ? '#ef4444' : t.flag_color === 'Orange' ? '#f97316' : t.flag_color === 'Yellow' ? '#fbbf24' : '#1a56db';

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', flexDirection: 'column', maxWidth: 640, margin: '0 auto' }}>
      {/* Header */}
      <header className="bg-employee-header" style={{ padding: '12px 20px', boxShadow: '0 2px 10px rgba(26,86,219,0.25)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, background: 'rgba(255,255,255,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🚂</div>
            <div>
              <h1 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'white' }}>RailAwaas Care</h1>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>{user.name} · {user.quarter_type} {user.quarter_no}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <NotificationBell userPf={user.pf_no} />
            <button onClick={() => setShowEditProfile(true)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: '6px 10px', cursor: 'pointer', color: 'white', fontSize: 11, fontWeight: 600 }}>
              ⚙️ Profile
            </button>
            <button onClick={() => { logout(); onLogout(); }} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', color: 'white', display: 'flex' }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Nav Tabs */}
      <div style={{ background: 'white', borderBottom: '1px solid #f1f5f9', padding: '0 20px', position: 'sticky', top: 62, zIndex: 99 }}>
        <div style={{ display: 'flex' }}>
          {[
            { id: 'home', label: '🏠 Home' },
            { id: 'raise', label: '➕ Raise' },
            { id: 'history', label: '📋 History' },
            { id: 'notifications', label: `🔔 Alerts${unreadNotifs > 0 ? ` (${unreadNotifs})` : ''}` },
          ].map(tab => (
            <button key={tab.id} onClick={() => setView(tab.id as any)} style={{
              flex: 1, padding: '12px 0', border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 11, fontWeight: view === tab.id ? 700 : 500,
              color: view === tab.id ? '#1a56db' : '#64748b',
              borderBottom: `2px solid ${view === tab.id ? '#1a56db' : 'transparent'}`,
              transition: 'all 0.2s', whiteSpace: 'nowrap',
            }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main style={{ flex: 1, padding: '16px 16px 80px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* HOME */}
        {view === 'home' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Unique Code Card */}
            {user.unique_code && (
              <div className="unique-code-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Your RailAwaas Identity</p>
                    <div className="unique-code-value">{user.unique_code}</div>
                    <p style={{ margin: '4px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>PF: {user.pf_no} · {user.role}</p>
                  </div>
                  <button onClick={copyCode} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'white', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {codeCopied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                  </button>
                </div>
              </div>
            )}

            {/* Overdue Alert */}
            {overdueTickets.length > 0 && (
              <div className="urgency-banner">
                <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: '#991b1b' }}>⚠️ {overdueTickets.length} Ticket{overdueTickets.length > 1 ? 's' : ''} SLA Overdue!</p>
                <p style={{ margin: 0, fontSize: 11, color: '#b91c1c' }}>Your complaints have exceeded the SLA deadline. Please follow up.</p>
              </div>
            )}

            {/* Stats Strip */}
            <div className="stats-strip">
              {[
                { label: 'Total', value: tickets.length, color: '#1a56db', bg: '#eff6ff' },
                { label: 'Active', value: activeTickets.length, color: '#d97706', bg: '#fffbeb' },
                { label: 'Overdue', value: overdueTickets.length, color: '#dc2626', bg: '#fef2f2' },
                { label: 'Closed', value: closedTickets.length, color: '#10b981', bg: '#ecfdf5' },
                { label: 'Major Overhaul', value: tickets.filter(t => t.major_overhaul).length, color: '#7c3aed', bg: '#f5f3ff' },
              ].map(s => (
                <div key={s.label} className="stats-strip-item" style={{ background: s.bg, borderColor: 'transparent' }}>
                  <p style={{ margin: '0 0 2px', fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</p>
                  <p style={{ margin: 0, fontSize: 10, color: s.color, fontWeight: 600, opacity: 0.75 }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { icon: <QrCode size={20} />, label: 'Scan QR', color: '#1a56db', bg: '#eff6ff', action: () => setShowQR(true) },
                { icon: <Plus size={20} />, label: 'New Request', color: '#10b981', bg: '#ecfdf5', action: () => setView('raise') },
                { icon: <Download size={20} />, label: 'Download', color: '#7c3aed', bg: '#f5f3ff', action: downloadMyReport },
              ].map(btn => (
                <button key={btn.label} onClick={btn.action} style={{
                  background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: '14px 8px',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)', transition: 'all 0.2s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: btn.bg, color: btn.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {btn.icon}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{btn.label}</span>
                </button>
              ))}
            </div>

            {/* QR Scanner */}
            {showQR && (
              <div className="animate-scale-in" style={{ background: 'white', borderRadius: 16, padding: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
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

            {/* Visit Schedule Card */}
            {activeTickets.some(t => t.visit_scheduled_at) && (
              <div className="visit-card animate-fade-in-up">
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.06em' }}>📅 Upcoming IOW Visit</p>
                {activeTickets.filter(t => t.visit_scheduled_at).slice(0, 2).map(t => (
                  <div key={t.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid rgba(5,150,105,0.15)' }}>
                    <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: '#065f46' }}>
                      🗓️ {new Date(t.visit_scheduled_at).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                      {t.visit_notes && ` · ${t.visit_notes}`}
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: '#059669' }}>Ticket #{t.id} · {t.category} — {t.sub_category}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Active Tickets */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Active Complaints ({activeTickets.length})</h3>
              <button onClick={() => setView('history')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#1a56db', fontWeight: 600 }}>View All →</button>
            </div>

            {activeTickets.length === 0 ? (
              <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                <p style={{ margin: '0 0 4px', fontSize: 32 }}>✅</p>
                <p style={{ margin: 0, fontSize: 14 }}>No active complaints. All resolved!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {activeTickets.map(t => (
                  <div key={t.id} className="animate-fade-in-up" style={{
                    background: 'white', borderRadius: 16, borderLeft: `4px solid ${flagColor(t)}`,
                    border: '1px solid #e2e8f0', boxShadow: t.flag_color === 'Red' ? '0 4px 16px rgba(239,68,68,0.12)' : '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden',
                  }}>
                    <div style={{ padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 3 }}>
                            <span style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>#{t.id.slice(-6)}</span>
                            <PriorityBadge priority={t.priority} size="sm" />
                            {t.flag_color !== 'None' && (
                              <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: t.flag_color === 'Red' ? '#fef2f2' : '#fff7ed', color: t.flag_color === 'Red' ? '#dc2626' : '#c2410c' }}>
                                {t.flag_color === 'Red' ? '🔴' : t.flag_color === 'Orange' ? '🟠' : '🟡'} {t.flag_color}
                              </span>
                            )}
                            {t.urgency_escalated && <span style={{ fontSize: 9, fontWeight: 800, color: '#dc2626', background: '#fef2f2', padding: '2px 6px', borderRadius: 4 }}>🆘 ESCALATED</span>}
                            {t.major_overhaul && <span style={{ fontSize: 9, fontWeight: 800, color: '#7c3aed', background: '#f5f3ff', padding: '2px 6px', borderRadius: 4 }}>🏚️ OVERHAUL</span>}
                          </div>
                          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{t.category} · {t.sub_category}</p>
                          <p style={{ margin: '1px 0 0', fontSize: 10, color: '#94a3b8' }}>{new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </div>
                        <span className={`badge ${STATUS_CSS[t.status] || 'badge-submitted'}`}>{STATUS_ICONS[t.status]} {t.status}</span>
                      </div>

                      <p style={{ margin: '0 0 8px', fontSize: 12, color: '#475569', background: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>{t.description}</p>

                      {/* IOW info */}
                      {t.iow && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: '#fff7ed', borderRadius: 8, marginBottom: 8, border: '1px solid #fde68a' }}>
                          <span style={{ fontSize: 12 }}>🔧</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#92400e' }}>IOW: {t.iow.name}</span>
                          <span style={{ fontSize: 10, color: '#b45309', fontFamily: 'monospace' }}>PF: {t.iow.pf_no}</span>
                          {t.iow.unique_code && <span style={{ fontSize: 10, color: '#b45309' }}>· {t.iow.unique_code}</span>}
                        </div>
                      )}

                      {/* SLA Bar */}
                      <SLABar deadline={t.SLA_deadline} />

                      {/* OTP Section */}
                      {t.status === 'Resolved' && t.closure_otp && (
                        <div className="otp-card" style={{ marginTop: 10, marginBottom: 8 }}>
                          <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>🔑 Share OTP with IOW to Close</p>
                          <div className="otp-code">{t.closure_otp}</div>
                          <p style={{ margin: '6px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Valid until ticket is closed · Keep confidential</p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        {/* Urgency escalate for overdue tickets */}
                        {new Date(t.SLA_deadline) < new Date() && !t.urgency_escalated && t.status !== 'Resolved' && (
                          <button onClick={() => escalateUrgency(t.id)} disabled={escalatingId === t.id} style={{
                            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '5px 10px',
                            cursor: 'pointer', fontSize: 11, color: '#dc2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                            {escalatingId === t.id ? '⏳' : <AlertTriangle size={12} />} Still Not Resolved
                          </button>
                        )}

                        {/* Expand timeline */}
                        <button onClick={() => setExpandedId(expandedId === t.id ? null : t.id)} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                          {expandedId === t.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          {expandedId === t.id ? 'Hide' : 'Timeline'}
                        </button>
                      </div>
                    </div>

                    {expandedId === t.id && (
                      <div className="animate-fade-in" style={{ borderTop: '1px solid #f1f5f9', padding: '0 16px 16px' }}>
                        <TicketTimeline status={t.status} />
                        <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 8, paddingTop: 12 }}>
                          {auditTicketId === t.id ? (
                            <AuditChainViewer ticketId={t.id} onClose={() => setAuditTicketId(null)} />
                          ) : (
                            <button onClick={() => setAuditTicketId(t.id)} style={{ width: '100%', padding: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#1a56db', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
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
                  <select required className="rail-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value, sub_categories: [], custom_issue: '' })}>
                    <option value="">Select Department</option>
                    {Object.keys(SLA_MATRIX).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                {form.category && (
                  <div className="animate-fade-in">
                    <label className="rail-label">Select Issues (Multiple allowed) *</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: '#f8fafc', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      {SLA_MATRIX[form.category].map(s => (
                        <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: form.sub_categories.includes(s) ? '#1a56db' : '#1e293b', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, background: form.sub_categories.includes(s) ? '#eff6ff' : 'transparent', transition: 'all 0.15s' }}>
                          <input type="checkbox" checked={form.sub_categories.includes(s)}
                            onChange={() => setForm(f => ({ ...f, sub_categories: f.sub_categories.includes(s) ? f.sub_categories.filter(x => x !== s) : [...f.sub_categories, s] }))}
                            style={{ width: 15, height: 15, accentColor: '#1a56db' }} />
                          {s}
                        </label>
                      ))}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b', cursor: 'pointer', padding: '4px 6px' }}>
                        <input type="checkbox" checked={form.sub_categories.includes('Other / New Problem')}
                          onChange={() => setForm(f => ({ ...f, sub_categories: f.sub_categories.includes('Other / New Problem') ? f.sub_categories.filter(x => x !== 'Other / New Problem') : [...f.sub_categories, 'Other / New Problem'] }))}
                          style={{ width: 15, height: 15, accentColor: '#1a56db' }} />
                        Other / New Problem
                      </label>
                    </div>
                  </div>
                )}
                {form.sub_categories.includes('Other / New Problem') && (
                  <div className="animate-fade-in">
                    <label className="rail-label">Specify New Problem *</label>
                    <input required type="text" className="rail-input" placeholder="E.g. Pest control needed" value={form.custom_issue} onChange={e => setForm({ ...form, custom_issue: e.target.value })} />
                  </div>
                )}
                {form.sub_categories.length > 0 && (
                  <div className="animate-fade-in" style={{ background: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#1e40af' }}>
                    ℹ️ SLA & Priority will be auto-assigned based on your most critical selection.
                  </div>
                )}
                <div>
                  <label className="rail-label">Description *</label>
                  <textarea required className="rail-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} placeholder="Describe the issue in detail..." style={{ resize: 'none' }} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" onClick={() => setView('home')} className="btn-ghost" style={{ flex: 1 }}>Cancel</button>
                  <button type="submit" disabled={submitting || !form.category || form.sub_categories.length === 0 || !form.description} className="btn-primary" style={{ flex: 2 }}>
                    {submitting ? '⏳ Submitting...' : '📤 Submit Complaint'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* HISTORY */}
        {view === 'history' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Filters */}
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '12px 14px' }}>
              <div className="search-input-wrap" style={{ marginBottom: 10 }}>
                <Search size={14} className="search-icon" />
                <input className="rail-input" style={{ paddingLeft: 36, fontSize: 13 }} placeholder="Search tickets..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
              </div>
              <div className="filter-pills">
                {['All', 'Submitted', 'In-Progress', 'Resolved', 'Closed'].map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)} className={`filter-pill ${filterStatus === s ? 'filter-pill-active' : ''}`}>{s}</button>
                ))}
              </div>
              <div className="filter-pills" style={{ marginTop: 6 }}>
                <button onClick={() => setFilterCategory('All')} className={`filter-pill ${filterCategory === 'All' ? 'filter-pill-active' : ''}`}>All Cats</button>
                {Object.keys(SLA_MATRIX).map(c => (
                  <button key={c} onClick={() => setFilterCategory(c)} className={`filter-pill ${filterCategory === c ? 'filter-pill-active' : ''}`}>{c}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>All Tickets ({displayTickets.length})</h3>
              <button onClick={downloadMyReport} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 11, color: '#1a56db', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Download size={12} /> Export
              </button>
            </div>

            {displayTickets.length === 0 ? (
              <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                <p style={{ margin: 0, fontSize: 14 }}>No tickets match the filter.</p>
              </div>
            ) : (
              displayTickets.map(t => (
                <div key={t.id} style={{
                  background: 'white', borderRadius: 14, border: '1px solid #e2e8f0',
                  borderLeft: `4px solid ${flagColor(t)}`,
                  padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>#{t.id.slice(-6)} · {t.category}</span>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>{t.sub_category}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span className={`badge ${STATUS_CSS[t.status] || 'badge-submitted'}`}>{STATUS_ICONS[t.status]} {t.status}</span>
                      <PriorityBadge priority={t.priority} size="sm" />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>
                    <span>Raised: {new Date(t.created_at).toLocaleDateString('en-IN')}</span>
                    {t.closed_at && <span>Closed: {new Date(t.closed_at).toLocaleDateString('en-IN')}</span>}
                    {t.rating && <span style={{ color: '#f59e0b', fontWeight: 700 }}>⭐ {t.rating}/5</span>}
                  </div>

                  {/* Rate if closed and unrated */}
                  {t.status === 'Closed' && !t.rating && (
                    <button onClick={() => { setRatingModal(t); setRatingVal(0); setRatingComment(''); }} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: '#d97706', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Star size={12} /> Rate this service
                    </button>
                  )}

                  {/* Reopen if closed within 7 days */}
                  {t.status === 'Closed' && t.closed_at && new Date(t.closed_at).getTime() > Date.now() - 7 * 24 * 3600 * 1000 && (
                    <button onClick={() => { setReopenModal(t); setReopenReason(''); }} style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: '#7c3aed', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginTop: t.status === 'Closed' && !t.rating ? 6 : 0 }}>
                      <RotateCcw size={12} /> Reopen (within 7 days)
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* NOTIFICATIONS */}
        {view === 'notifications' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Notifications ({notifications.length})</h3>
              <button onClick={async () => { await fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_pf: user.pf_no }) }); fetchNotifications(); }} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 11, color: '#1a56db', fontWeight: 600 }}>
                Mark All Read
              </button>
            </div>
            {notifications.length === 0 ? (
              <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                <p style={{ fontSize: 32, margin: '0 0 8px' }}>🔔</p>
                <p style={{ margin: 0, fontSize: 14 }}>No notifications yet.</p>
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id} style={{ background: n.is_read ? 'white' : '#eff6ff', borderRadius: 12, border: `1px solid ${n.is_read ? '#e2e8f0' : '#bfdbfe'}`, padding: '12px 14px', transition: 'all 0.2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: n.is_read ? 500 : 700, color: '#1e293b' }}>{n.title}</p>
                    <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>{new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.5 }}>{n.body}</p>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Rating Modal */}
      {ratingModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 360 }}>
            <div style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', padding: '16px 20px', color: 'white' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>⭐ Rate this Service</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, opacity: 0.85 }}>Ticket #{ratingModal.id.slice(-6)} · {ratingModal.category}</p>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ margin: '0 0 12px', fontSize: 14, color: '#1e293b', textAlign: 'center', fontWeight: 600 }}>How was the service quality?</p>
              <StarRating value={ratingVal} onChange={setRatingVal} />
              <div style={{ marginTop: 16 }}>
                <label className="rail-label">Comment (optional)</label>
                <textarea className="rail-input" rows={3} value={ratingComment} onChange={e => setRatingComment(e.target.value)} placeholder="Write your feedback..." style={{ resize: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => setRatingModal(null)} className="btn-ghost" style={{ flex: 1 }}>Skip</button>
                <button onClick={submitRating} disabled={ratingSubmitting || !ratingVal} className="btn-primary" style={{ flex: 2 }}>
                  {ratingSubmitting ? 'Submitting...' : '⭐ Submit Rating'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reopen Modal */}
      {reopenModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 380 }}>
            <div style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', padding: '16px 20px', color: 'white' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>🔄 Reopen Ticket</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, opacity: 0.85 }}>Within 7 days of closure only</p>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: '#475569' }}>The issue has recurred or was not properly resolved. Please state the reason:</p>
              <textarea className="rail-input" rows={3} value={reopenReason} onChange={e => setReopenReason(e.target.value)} placeholder="Reason for reopening..." style={{ resize: 'none' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button onClick={() => setReopenModal(null)} className="btn-ghost" style={{ flex: 1 }}>Cancel</button>
                <button onClick={submitReopen} disabled={!reopenReason.trim()} className="btn-primary" style={{ flex: 2 }}>🔄 Reopen</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditProfile && (
        <EditProfileModal user={user} onClose={() => setShowEditProfile(false)} onUpdate={setUser} />
      )}
    </div>
  );
}
