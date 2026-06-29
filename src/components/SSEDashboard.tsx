import React, { useState, useEffect, useCallback } from 'react';
import { LogOut, Users, Clipboard, CheckCircle, XCircle, Clock, BarChart2, RefreshCw, Search, Filter, AlertTriangle, Calendar, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { logout } from '../firebase';
import PriorityBadge from './PriorityBadge';
import NotificationBell from './NotificationBell';

interface Ticket {
  id: string; pf_no: string; category: string; sub_category: string;
  description: string; priority: string; status: string; SLA_deadline: string;
  assigned_iow?: string; flag_color: string; major_overhaul?: boolean;
  urgency_escalated?: boolean; created_at: string; estimated_cost?: number;
  visit_scheduled_at?: string;
  user?: { name: string; pf_no: string; unique_code?: string; quarter_type?: string; quarter_no?: string; department?: string };
  iow?: { name: string; pf_no: string; unique_code?: string; designation?: string };
}

interface IOW { pf_no: string; name: string; designation: string; is_on_leave?: boolean; average_rating?: number; unique_code?: string; }
interface ExtensionRequest {
  id: string; ticket_id: string; iow_pf: string; reason: string; requested_hours: number;
  status: string; ticket: Ticket; iow: { name: string };
}

function ScheduleVisitModal({ ticket, iows, onClose, onSuccess }: { ticket: Ticket; iows: IOW[]; onClose: () => void; onSuccess: () => void }) {
  const [iowPf, setIowPf] = useState(ticket.assigned_iow || '');
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const slots = ['08:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00', '16:00-18:00'];

  const submit = async () => {
    if (!date || !timeSlot || !iowPf) return;
    setLoading(true);
    await fetch(`/api/tickets/${ticket.id}/visit-schedule`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ iow_pf: iowPf, scheduled_at: date, time_slot: timeSlot, notes, created_by: ticket.pf_no }),
    });
    setLoading(false);
    onSuccess();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 420 }}>
        <div style={{ background: 'linear-gradient(135deg, #5b21b6, #7c3aed)', padding: '16px 20px', color: 'white', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>📅 Schedule IOW Visit</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, opacity: 0.85 }}>Ticket #{ticket.id.slice(-6)} · {ticket.category}</p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'white' }}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="rail-label">Assign IOW *</label>
            <select className="rail-input" value={iowPf} onChange={e => setIowPf(e.target.value)}>
              <option value="">— Select IOW —</option>
              {iows.filter(i => !i.is_on_leave).map(i => <option key={i.pf_no} value={i.pf_no}>{i.name} ({i.pf_no}) {i.average_rating ? `⭐${i.average_rating}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="rail-label">Visit Date *</label>
            <input type="date" className="rail-input" value={date} onChange={e => setDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
          </div>
          <div>
            <label className="rail-label">Time Slot *</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {slots.map(s => (
                <button key={s} onClick={() => setTimeSlot(s)} style={{ padding: '8px', border: `1.5px solid ${timeSlot === s ? '#7c3aed' : '#e2e8f0'}`, borderRadius: 8, background: timeSlot === s ? '#f5f3ff' : 'white', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: timeSlot === s ? '#7c3aed' : '#64748b' }}>{s}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="rail-label">Notes (optional)</label>
            <input className="rail-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="E.g. Call before arriving" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} className="btn-ghost" style={{ flex: 1 }}>Cancel</button>
            <button onClick={submit} disabled={loading || !date || !timeSlot || !iowPf} className="btn-primary" style={{ flex: 2, background: 'linear-gradient(135deg, #7c3aed, #5b21b6)' }}>
              {loading ? 'Scheduling...' : '📅 Confirm Visit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SSEDashboard({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [iows, setIows] = useState<IOW[]>([]);
  const [extensions, setExtensions] = useState<ExtensionRequest[]>([]);
  const [pendingOwners, setPendingOwners] = useState<Ticket[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'tickets' | 'workload' | 'extensions' | 'schedule'>('pending');
  const [assigning, setAssigning] = useState<Record<string, string>>({});
  const [reassignReason, setReassignReason] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterFlag, setFilterFlag] = useState('All');
  const [scheduleModal, setScheduleModal] = useState<Ticket | null>(null);
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const [bulkIow, setBulkIow] = useState('');
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, iRes, eRes, pRes] = await Promise.all([
        fetch('/api/tickets?role=SSE'),
        fetch('/api/users/iows'),
        fetch('/api/extensions/pending'),
        fetch('/api/tickets/pending-with-owners'),
      ]);
      const [tData, iData, eData, pData] = await Promise.all([tRes.json(), iRes.json(), eRes.json(), pRes.json()]);
      if (tData.success) setTickets(tData.tickets);
      if (iData.success) setIows(iData.iows);
      if (eData.success) setExtensions(eData.requests);
      if (pData.success) setPendingOwners(pData.tickets);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const assignTicket = async (ticketId: string, iow_pf: string, reason?: string) => {
    if (!iow_pf) return;
    await fetch(`/api/tickets/${ticketId}/assign`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ iow_pf, assigned_by: user.pf_no, reassign_reason: reason || null }),
    });
    fetchAll();
  };

  const handleExtension = async (reqId: string, status: 'Approved' | 'Rejected') => {
    await fetch(`/api/extensions/${reqId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, approved_by: user.pf_no }),
    });
    fetchAll();
  };

  const bulkAssign = async () => {
    if (!bulkIow || bulkSelected.length === 0) return;
    await Promise.all(bulkSelected.map(id => assignTicket(id, bulkIow)));
    setBulkSelected([]);
    setBulkIow('');
  };

  // Workload
  const workload: Record<string, { iow: IOW | null; total: number; open: number; overdue: number }> = {};
  iows.forEach(iow => { workload[iow.pf_no] = { iow, total: 0, open: 0, overdue: 0 }; });
  tickets.forEach(t => {
    if (t.assigned_iow && workload[t.assigned_iow]) {
      workload[t.assigned_iow].total++;
      if (t.status !== 'Closed') workload[t.assigned_iow].open++;
      if (new Date(t.SLA_deadline) < new Date() && t.status !== 'Closed') workload[t.assigned_iow].overdue++;
    }
  });

  // Get smart assignment suggestion (IOW with least open tickets, not on leave)
  const getSmartSuggestion = () => {
    const avail = iows.filter(i => !i.is_on_leave);
    if (!avail.length) return null;
    return avail.reduce((best, iow) => (workload[iow.pf_no]?.open || 0) < (workload[best.pf_no]?.open || 0) ? iow : best);
  };

  // Filtered tickets
  let displayTickets = tickets;
  if (filterCategory !== 'All') displayTickets = displayTickets.filter(t => t.category === filterCategory);
  if (filterPriority !== 'All') displayTickets = displayTickets.filter(t => t.priority === filterPriority);
  if (filterFlag !== 'All') displayTickets = displayTickets.filter(t => filterFlag === 'Urgency' ? t.urgency_escalated : t.flag_color === filterFlag);
  if (searchQ) displayTickets = displayTickets.filter(t =>
    (t.user?.name || '').toLowerCase().includes(searchQ.toLowerCase()) ||
    t.pf_no.includes(searchQ) || t.category.toLowerCase().includes(searchQ.toLowerCase()) ||
    t.id.includes(searchQ) || (t.iow?.name || '').toLowerCase().includes(searchQ.toLowerCase())
  );

  const flagBg: Record<string, string> = { Red: '#fef2f2', Orange: '#fff7ed', Yellow: '#fffbeb', None: '#f8fafc' };
  const flagBorder: Record<string, string> = { Red: '#fecaca', Orange: '#fed7aa', Yellow: '#fde68a', None: '#e2e8f0' };
  const flagLeftColor: Record<string, string> = { Red: '#ef4444', Orange: '#f97316', Yellow: '#fbbf24', None: '#e2e8f0' };

  const urgencyCount = tickets.filter(t => t.urgency_escalated).length;
  const unassignedCount = tickets.filter(t => !t.assigned_iow).length;
  const breachedCount = tickets.filter(t => new Date(t.SLA_deadline) < new Date() && t.status !== 'Closed').length;
  const majorOverhaulCount = tickets.filter(t => t.major_overhaul).length;

  const downloadReport = () => {
    const rows = tickets.map(t =>
      `#${t.id.slice(-6)} | ${t.category} - ${t.sub_category} | ${t.status} | ${t.priority} | Employee: ${t.user?.name || t.pf_no} | IOW: ${t.iow?.name || 'Unassigned'} | SLA: ${new Date(t.SLA_deadline).toLocaleDateString('en-IN')}`
    ).join('\n');
    const blob = new Blob([`SSE Report — ${user.name}\n${new Date().toLocaleString('en-IN')}\n\n${rows}`], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `SSE_Report_${user.pf_no}.txt`; a.click();
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header className="bg-sse-header" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.15)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clipboard size={20} color="white" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'white', letterSpacing: '-0.3px' }}>SSE Command</h1>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>{user.name} · {user.unique_code || user.pf_no}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={fetchAll} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', color: 'white', display: 'flex' }}><RefreshCw size={16} /></button>
          <button onClick={downloadReport} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', color: 'white', display: 'flex' }}><Download size={16} /></button>
          <NotificationBell userPf={user.pf_no} />
          <button onClick={() => { logout(); onLogout(); }} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      {/* Stats Strip */}
      <div className="stats-strip" style={{ padding: '12px 20px 4px' }}>
        {[
          { label: 'Total', value: tickets.length, color: '#1a56db' },
          { label: 'Unassigned', value: unassignedCount, color: '#d97706' },
          { label: 'SLA Breach', value: breachedCount, color: '#dc2626' },
          { label: '🆘 Urgency', value: urgencyCount, color: '#dc2626' },
          { label: 'Ext. Req', value: extensions.length, color: '#7c3aed' },
          { label: 'Overhaul', value: majorOverhaulCount, color: '#7c3aed' },
          { label: 'IOWs', value: iows.length, color: '#059669' },
          { label: 'On Leave', value: iows.filter(i => i.is_on_leave).length, color: '#94a3b8' },
        ].map(s => (
          <div key={s.label} className="stats-strip-item">
            <p style={{ margin: '0 0 2px', fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</p>
            <p style={{ margin: 0, fontSize: 9, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Urgency Alert */}
      {urgencyCount > 0 && (
        <div className="urgency-banner" style={{ margin: '8px 20px', animation: 'pulse-red 2s ease-in-out infinite' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#991b1b' }}>🆘 {urgencyCount} ticket{urgencyCount > 1 ? 's' : ''} escalated as "STILL NOT RESOLVED" by employees — Immediate action needed!</p>
        </div>
      )}

      {/* Bulk Assign Bar */}
      {bulkSelected.length > 0 && (
        <div className="animate-slide-down" style={{ margin: '0 20px 8px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 12, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>📦 {bulkSelected.length} tickets selected</span>
          <select className="rail-input" style={{ flex: 1, padding: '7px 10px', fontSize: 12 }} value={bulkIow} onChange={e => setBulkIow(e.target.value)}>
            <option value="">— Select IOW to bulk assign —</option>
            {iows.filter(i => !i.is_on_leave).map(i => <option key={i.pf_no} value={i.pf_no}>{i.name} ({i.pf_no})</option>)}
          </select>
          <button onClick={bulkAssign} disabled={!bulkIow} style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Assign All</button>
          <button onClick={() => setBulkSelected([])} style={{ background: 'none', border: '1px solid #ddd6fe', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#7c3aed', cursor: 'pointer' }}>Clear</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ padding: '8px 20px 0' }}>
        <div style={{ display: 'flex', gap: 0, background: '#f1f5f9', borderRadius: 12, padding: 4, overflowX: 'auto' }}>
          {([
            { id: 'pending', label: `📍 Pending (${pendingOwners.length})` },
            { id: 'tickets', label: `🎫 All (${tickets.length})` },
            { id: 'workload', label: '📊 Workload' },
            { id: 'extensions', label: `🔁 Ext (${extensions.length})` },
            { id: 'schedule', label: '📅 Schedule' },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`tab-btn ${activeTab === tab.id ? 'tab-btn-active' : ''}`} style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main style={{ flex: 1, padding: '12px 20px 20px', overflowY: 'auto' }}>

        {/* PENDING OWNERS TAB — "Kab Kiske Pas Hai" */}
        {activeTab === 'pending' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '14px 16px' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>📍 Ticket Ownership Tracker</h3>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Shows exactly who has which ticket and how long it's been pending</p>
            </div>
            {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div> : pendingOwners.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', background: 'white', borderRadius: 14, border: '1px solid #e2e8f0' }}>
                <CheckCircle size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                <p style={{ margin: 0 }}>All tickets are closed!</p>
              </div>
            ) : (
              pendingOwners.map(t => {
                const daysPending = Math.floor((Date.now() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24));
                const isOverdue = new Date(t.SLA_deadline) < new Date();
                return (
                  <div key={t.id} className="owner-row animate-fade-in-up" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8, background: t.urgency_escalated ? '#fef2f2' : 'white', borderColor: t.urgency_escalated ? '#fecaca' : '#e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>#{t.id.slice(-6)}</span>
                          <PriorityBadge priority={t.priority} size="sm" />
                          {isOverdue && <span style={{ fontSize: 9, fontWeight: 800, color: '#dc2626', background: '#fef2f2', padding: '2px 5px', borderRadius: 3 }}>OVERDUE</span>}
                          {t.urgency_escalated && <span style={{ fontSize: 9, fontWeight: 800, color: '#dc2626', background: '#fef2f2', padding: '2px 5px', borderRadius: 3 }}>🆘 ESCALATED</span>}
                          {t.major_overhaul && <span style={{ fontSize: 9, fontWeight: 800, color: '#7c3aed', background: '#f5f3ff', padding: '2px 5px', borderRadius: 3 }}>OVERHAUL</span>}
                        </div>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#374151' }}>{t.category} → {t.sub_category}</p>
                      </div>
                      <span style={{ fontSize: 11, color: daysPending > 7 ? '#dc2626' : daysPending > 3 ? '#d97706' : '#64748b', fontWeight: 700, flexShrink: 0 }}>
                        {daysPending === 0 ? 'Today' : `${daysPending}d ago`}
                      </span>
                    </div>

                    {/* Ownership Chain */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', width: '100%' }}>
                      <div className="owner-chip owner-chip-employee">
                        👤 {t.user?.name || t.pf_no}
                        <span style={{ fontFamily: 'monospace', fontSize: 10, opacity: 0.75 }}>({t.pf_no})</span>
                        {t.user?.unique_code && <span style={{ fontSize: 9, opacity: 0.6 }}>· {t.user.unique_code}</span>}
                      </div>
                      <span className="owner-arrow">→</span>
                      {t.iow ? (
                        <div className="owner-chip owner-chip-iow">
                          🔧 {t.iow.name}
                          <span style={{ fontFamily: 'monospace', fontSize: 10, opacity: 0.75 }}>({t.iow.pf_no})</span>
                          {t.iow.unique_code && <span style={{ fontSize: 9, opacity: 0.6 }}>· {t.iow.unique_code}</span>}
                        </div>
                      ) : (
                        <div className="owner-chip owner-chip-unassigned">⚠️ Unassigned</div>
                      )}
                      <span className="owner-arrow">→</span>
                      <span style={{ fontSize: 11, color: t.status === 'Resolved' ? '#059669' : '#94a3b8', fontWeight: 600 }}>{t.status}</span>
                    </div>

                    {/* Quarter info */}
                    {t.user?.quarter_type && (
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>🏠 {t.user.quarter_type} {t.user.quarter_no} · {t.user.department} · SLA: {new Date(t.SLA_deadline).toLocaleDateString('en-IN')}</div>
                    )}

                    {/* Visit scheduled */}
                    {t.visit_scheduled_at && (
                      <div style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>📅 Visit: {new Date(t.visit_scheduled_at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                    )}

                    {/* Quick assign */}
                    <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                      <select className="rail-input" style={{ flex: 1, padding: '7px 10px', fontSize: 12 }} value={assigning[t.id] ?? t.assigned_iow ?? ''}
                        onChange={e => setAssigning(a => ({ ...a, [t.id]: e.target.value }))}>
                        <option value="">— Assign/Reassign IOW —</option>
                        {iows.filter(i => !i.is_on_leave).map(i => (
                          <option key={i.pf_no} value={i.pf_no}>{i.name} ({workload[i.pf_no]?.open || 0} open) {i.average_rating ? `⭐${i.average_rating}` : ''}</option>
                        ))}
                      </select>
                      <button onClick={() => assignTicket(t.id, assigning[t.id] || t.assigned_iow || '', reassignReason[t.id])}
                        disabled={!(assigning[t.id] || t.assigned_iow)}
                        style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: 9, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: !(assigning[t.id] || t.assigned_iow) ? 0.4 : 1 }}>
                        {t.assigned_iow ? '↺ Re' : '+ Assign'}
                      </button>
                      <button onClick={() => setScheduleModal(t)} style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 9, padding: '7px 12px', fontSize: 12, color: '#059669', fontWeight: 600, cursor: 'pointer' }}>
                        📅
                      </button>
                    </div>

                    {/* Checkbox for bulk */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b', cursor: 'pointer' }}>
                      <input type="checkbox" checked={bulkSelected.includes(t.id)} onChange={e => setBulkSelected(prev => e.target.checked ? [...prev, t.id] : prev.filter(x => x !== t.id))} />
                      Select for bulk assign
                    </label>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ALL TICKETS TAB */}
        {activeTab === 'tickets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Filters */}
            <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '10px 12px' }}>
              <div className="search-input-wrap" style={{ marginBottom: 8 }}>
                <Search size={13} className="search-icon" />
                <input className="rail-input" style={{ paddingLeft: 34, fontSize: 12 }} placeholder="Search by name, PF, category, ticket ID..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
              </div>
              <div className="filter-pills">
                {['All', 'Civil', 'Electrical', 'Sanitary', 'Carpentry', 'Painting'].map(c => (
                  <button key={c} onClick={() => setFilterCategory(c)} className={`filter-pill ${filterCategory === c ? 'filter-pill-active' : ''}`}>{c}</button>
                ))}
              </div>
              <div className="filter-pills" style={{ marginTop: 6 }}>
                {['All', 'Critical', 'High', 'Medium', 'Low', 'Red', 'Orange', 'Urgency'].map(f => (
                  <button key={f} onClick={() => { if (['Red','Orange','Urgency'].includes(f)) { setFilterFlag(f); setFilterPriority('All'); } else { setFilterPriority(f); setFilterFlag('All'); } }}
                    className={`filter-pill ${filterPriority === f ? (f === 'Critical' ? 'filter-pill-red-active' : 'filter-pill-active') : filterFlag === f ? 'filter-pill-red-active' : ''}`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div> : displayTickets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', background: 'white', borderRadius: 14, border: '1px solid #e2e8f0' }}>
                <CheckCircle size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                <p style={{ margin: 0 }}>No tickets match the filter!</p>
              </div>
            ) : (
              displayTickets.map(t => (
                <div key={t.id} className="animate-fade-in-up" style={{
                  background: flagBg[t.flag_color] || 'white',
                  border: `1px solid ${flagBorder[t.flag_color] || '#e2e8f0'}`,
                  borderLeft: `4px solid ${flagLeftColor[t.flag_color] || '#e2e8f0'}`,
                  borderRadius: 14, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>#{t.id.slice(-6)} · {t.category} — {t.sub_category}</span>
                        {t.flag_color !== 'None' && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: t.flag_color === 'Red' ? '#fef2f2' : '#fff7ed', color: t.flag_color === 'Red' ? '#dc2626' : '#c2410c' }}>
                            {t.flag_color === 'Red' ? '🔴 RED' : t.flag_color === 'Orange' ? '🟠 ORANGE' : '🟡 YELLOW'} FLAG
                          </span>
                        )}
                        {t.urgency_escalated && <span style={{ fontSize: 9, fontWeight: 800, color: '#dc2626', background: '#fef2f2', padding: '2px 5px', borderRadius: 3 }}>🆘 ESCALATED</span>}
                        {t.major_overhaul && <span style={{ fontSize: 9, fontWeight: 800, color: '#7c3aed', background: '#f5f3ff', padding: '2px 5px', borderRadius: 3 }}>🏚️ OVERHAUL</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <PriorityBadge priority={t.priority} size="sm" />
                        <span style={{ fontSize: 11, color: '#64748b' }}>👤 {t.user?.name || t.pf_no} ({t.pf_no})</span>
                        <span style={{ fontSize: 11, color: '#64748b' }}>SLA: {new Date(t.SLA_deadline).toLocaleDateString('en-IN')}</span>
                        {new Date(t.SLA_deadline) < new Date() && t.status !== 'Closed' && <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, padding: '1px 6px' }}>OVERDUE</span>}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: '#eff6ff', color: '#1d4ed8', whiteSpace: 'nowrap' }}>{t.status}</span>
                  </div>

                  {/* IOW Assignment */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,0.05)', flexWrap: 'wrap' }}>
                    <Users size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
                    <select className="rail-input" style={{ flex: 1, padding: '7px 10px', fontSize: 12 }}
                      value={assigning[t.id] ?? t.assigned_iow ?? ''}
                      onChange={e => setAssigning(a => ({ ...a, [t.id]: e.target.value }))}>
                      <option value="">— Assign IOW —</option>
                      {iows.filter(i => !i.is_on_leave).map(i => (
                        <option key={i.pf_no} value={i.pf_no}>{i.name} ({i.pf_no}) {workload[i.pf_no] ? `[${workload[i.pf_no].open} open]` : ''}</option>
                      ))}
                    </select>
                    <button onClick={() => assignTicket(t.id, assigning[t.id] || t.assigned_iow || '')} disabled={!(assigning[t.id] || t.assigned_iow)}
                      style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: 9, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: !(assigning[t.id] || t.assigned_iow) ? 0.4 : 1 }}>
                      {t.assigned_iow ? '↺ Reassign' : '+ Assign'}
                    </button>
                    <button onClick={() => setScheduleModal(t)} style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 9, padding: '7px 10px', fontSize: 12, color: '#059669', fontWeight: 600, cursor: 'pointer' }}>📅</button>
                  </div>
                  {t.assigned_iow && (
                    <p style={{ margin: '6px 0 0', fontSize: 11, color: '#059669', fontWeight: 600 }}>
                      ✅ Assigned: {t.iow?.name || t.assigned_iow} ({t.assigned_iow})
                      {t.iow?.unique_code && ` · ${t.iow.unique_code}`}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* WORKLOAD TAB */}
        {activeTab === 'workload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Smart suggestion */}
            {(() => { const s = getSmartSuggestion(); return s ? (
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderLeft: '4px solid #059669', borderRadius: 12, padding: '12px 16px' }}>
                <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 700, color: '#065f46' }}>🎯 Smart Suggestion</p>
                <p style={{ margin: 0, fontSize: 13, color: '#059669' }}>
                  Best available IOW: <strong>{s.name}</strong> ({s.pf_no}) — only {workload[s.pf_no]?.open || 0} open tickets
                </p>
              </div>
            ) : null; })()}

            {iows.map(iow => {
              const w = workload[iow.pf_no];
              const loadPct = w ? Math.min(100, (w.open / Math.max(1, w.total)) * 100) : 0;
              return (
                <div key={iow.pf_no} className="perf-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 36, height: 36, background: iow.is_on_leave ? '#f1f5f9' : '#fff7ed', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                          {iow.is_on_leave ? '🏖️' : '🔧'}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{iow.name}</p>
                          <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>{iow.pf_no} · {iow.unique_code || ''} · {iow.designation}</p>
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {iow.is_on_leave && <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>ON LEAVE</span>}
                      {iow.average_rating && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#f59e0b', fontWeight: 700 }}>⭐ {iow.average_rating}/5</p>}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                    {[
                      { label: 'Total', value: w?.total || 0, color: '#1a56db' },
                      { label: 'Open', value: w?.open || 0, color: '#d97706' },
                      { label: 'Overdue', value: w?.overdue || 0, color: w?.overdue ? '#dc2626' : '#10b981' },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: 'center', padding: '8px 4px', background: '#f8fafc', borderRadius: 8 }}>
                        <p style={{ margin: '0 0 2px', fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</p>
                        <p style={{ margin: 0, fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: '#94a3b8', fontWeight: 600 }}>Workload</span>
                      <span style={{ fontWeight: 700, color: loadPct > 80 ? '#dc2626' : loadPct > 50 ? '#f97316' : '#10b981' }}>{Math.round(loadPct)}%</span>
                    </div>
                    <div style={{ height: 8, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${loadPct}%`, background: loadPct > 80 ? '#ef4444' : loadPct > 50 ? '#f97316' : '#10b981', borderRadius: 999, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* EXTENSIONS TAB */}
        {activeTab === 'extensions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {extensions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', background: 'white', borderRadius: 14, border: '1px solid #e2e8f0' }}>
                <Clock size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                <p style={{ margin: 0 }}>No pending SLA extension requests.</p>
              </div>
            ) : (
              extensions.map(req => (
                <div key={req.id} className="animate-fade-in-up" style={{ background: 'white', border: '1px solid #e2e8f0', borderLeft: '4px solid #7c3aed', borderRadius: 14, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <p style={{ margin: '0 0 3px', fontWeight: 700, fontSize: 14, color: '#1e293b' }}>Ticket #{req.ticket_id.slice(-6)} · {req.ticket?.category} — {req.ticket?.sub_category}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>IOW: <strong>{req.iow?.name}</strong> · Requesting +{req.requested_hours} hours</p>
                    </div>
                    <span style={{ fontSize: 12, color: '#7c3aed', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 6, padding: '3px 10px', fontWeight: 600, height: 'fit-content' }}>PENDING</span>
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#475569' }}>
                    <strong>Reason:</strong> {req.reason}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleExtension(req.id, 'Approved')} className="btn-success" style={{ flex: 1, padding: '9px 0' }}>
                      <CheckCircle size={14} /> Approve +{req.requested_hours}h
                    </button>
                    <button onClick={() => handleExtension(req.id, 'Rejected')} className="btn-danger" style={{ flex: 1, padding: '9px 0' }}>
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* SCHEDULE TAB */}
        {activeTab === 'schedule' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '14px 16px' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>📅 Visit Schedule Manager</h3>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Click "📅" on any ticket in the Pending or All Tickets tab to schedule a visit</p>
            </div>
            {/* Tickets needing visit scheduling */}
            {tickets.filter(t => !t.visit_scheduled_at && t.status !== 'Closed' && t.status !== 'Resolved').slice(0, 10).map(t => (
              <div key={t.id} style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>#{t.id.slice(-6)} · {t.category} — {t.sub_category}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>👤 {t.user?.name || t.pf_no} · {t.iow ? `🔧 ${t.iow.name}` : '⚠️ Unassigned'}</p>
                </div>
                <button onClick={() => setScheduleModal(t)} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: '#1a56db', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Calendar size={12} /> Schedule
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      {scheduleModal && (
        <ScheduleVisitModal ticket={scheduleModal} iows={iows} onClose={() => setScheduleModal(null)} onSuccess={() => { setScheduleModal(null); fetchAll(); }} />
      )}
    </div>
  );
}
