import React, { useState, useEffect } from 'react';
import { LogOut, Users, Clipboard, CheckCircle, XCircle, Clock, BarChart2, RefreshCw } from 'lucide-react';
import { logout } from '../firebase';
import PriorityBadge from './PriorityBadge';
import NotificationBell from './NotificationBell';

interface Ticket {
  id: string;
  pf_no: string;
  category: string;
  sub_category: string;
  description: string;
  priority: string;
  status: string;
  SLA_deadline: string;
  assigned_iow?: string;
  flag_color: string;
}

interface IOW {
  pf_no: string;
  name: string;
  designation: string;
}

interface ExtensionRequest {
  id: string;
  ticket_id: string;
  iow_pf: string;
  reason: string;
  requested_hours: number;
  status: string;
  ticket: Ticket;
  iow: { name: string };
}

export default function SSEDashboard({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [iows, setIows] = useState<IOW[]>([]);
  const [extensions, setExtensions] = useState<ExtensionRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'tickets' | 'workload' | 'extensions'>('tickets');
  const [assigning, setAssigning] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [tRes, iRes, eRes] = await Promise.all([
        fetch('/api/tickets?role=SSE'),
        fetch('/api/users/iows'),
        fetch('/api/extensions/pending'),
      ]);
      const [tData, iData, eData] = await Promise.all([tRes.json(), iRes.json(), eRes.json()]);
      if (tData.success) setTickets(tData.tickets);
      if (iData.success) setIows(iData.iows);
      if (eData.success) setExtensions(eData.requests);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const assignTicket = async (ticketId: string, iow_pf: string) => {
    if (!iow_pf) return;
    await fetch(`/api/tickets/${ticketId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ iow_pf, assigned_by: user.pf_no }),
    });
    fetchAll();
  };

  const handleExtension = async (reqId: string, status: 'Approved' | 'Rejected') => {
    await fetch(`/api/extensions/${reqId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, approved_by: user.pf_no }),
    });
    fetchAll();
  };

  // Workload calculation
  const workload: Record<string, { iow: IOW | null; total: number; open: number; overdue: number }> = {};
  iows.forEach(iow => {
    workload[iow.pf_no] = { iow, total: 0, open: 0, overdue: 0 };
  });
  tickets.forEach(t => {
    if (t.assigned_iow && workload[t.assigned_iow]) {
      workload[t.assigned_iow].total++;
      if (t.status !== 'Closed') workload[t.assigned_iow].open++;
      if (new Date(t.SLA_deadline) < new Date() && t.status !== 'Closed') workload[t.assigned_iow].overdue++;
    }
  });

  const flagBg: Record<string, string> = { Red: '#fef2f2', Orange: '#fff7ed', Yellow: '#fffbeb', None: '#f8fafc' };
  const flagBorder: Record<string, string> = { Red: '#fecaca', Orange: '#fed7aa', Yellow: '#fde68a', None: '#e2e8f0' };

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header className="bg-sse-header" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clipboard size={20} color="white" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'white', letterSpacing: '-0.3px' }}>SSE Dashboard</h1>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>{user.name} · {user.designation || 'SSE'}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <NotificationBell userPf={user.pf_no} />
          <button onClick={() => { logout(); onLogout(); }}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: '16px 20px 0' }}>
        {[
          { label: 'Total Tickets', value: tickets.length, color: '#1a56db', bg: '#eff6ff' },
          { label: 'Unassigned', value: tickets.filter(t => !t.assigned_iow).length, color: '#d97706', bg: '#fffbeb' },
          { label: 'SLA Breached', value: tickets.filter(t => new Date(t.SLA_deadline) < new Date() && t.status !== 'Closed').length, color: '#dc2626', bg: '#fef2f2' },
          { label: 'Ext. Requests', value: extensions.length, color: '#7c3aed', bg: '#f5f3ff' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', borderRadius: 14, padding: '14px 16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ padding: '14px 20px 0' }}>
        <div className="tab-switcher" style={{ maxWidth: 400 }}>
          {(['tickets', 'workload', 'extensions'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`tab-btn ${activeTab === tab ? 'tab-btn-active' : ''}`}>
              {tab === 'tickets' ? '🎫 Tickets' : tab === 'workload' ? '📊 Workload' : `🔁 Extensions (${extensions.length})`}
            </button>
          ))}
        </div>
      </div>

      <main style={{ flex: 1, padding: '14px 20px 20px', overflowY: 'auto' }}>
        {/* TICKET QUEUE */}
        {activeTab === 'tickets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading tickets...</div>
            ) : tickets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', background: 'white', borderRadius: 14, border: '1px solid #e2e8f0' }}>
                <CheckCircle size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                <p style={{ margin: 0 }}>All tickets are closed. No pending work!</p>
              </div>
            ) : (
              tickets.map(t => (
                <div key={t.id} className="animate-fade-in-up" style={{
                  background: flagBg[t.flag_color] || 'white',
                  border: `1px solid ${flagBorder[t.flag_color] || '#e2e8f0'}`,
                  borderLeft: `4px solid ${t.flag_color === 'Red' ? '#ef4444' : t.flag_color === 'Orange' ? '#f97316' : t.flag_color === 'Yellow' ? '#fbbf24' : '#e2e8f0'}`,
                  borderRadius: 14,
                  padding: 16,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>#{t.id} · {t.category} — {t.sub_category}</span>
                        {t.flag_color !== 'None' && (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: t.flag_color === 'Red' ? '#fef2f2' : t.flag_color === 'Orange' ? '#fff7ed' : '#fffbeb', color: t.flag_color === 'Red' ? '#dc2626' : t.flag_color === 'Orange' ? '#c2410c' : '#d97706' }}>
                            {t.flag_color === 'Red' ? '🔴 RED' : t.flag_color === 'Orange' ? '🟠 ORANGE' : '🟡 YELLOW'} FLAG
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <PriorityBadge priority={t.priority} size="sm" />
                        <span style={{ fontSize: 11, color: '#64748b' }}>Employee: {t.pf_no}</span>
                        <span style={{ fontSize: 11, color: '#64748b' }}>SLA: {new Date(t.SLA_deadline).toLocaleDateString()}</span>
                        {new Date(t.SLA_deadline) < new Date() && t.status !== 'Closed' && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, padding: '1px 6px' }}>OVERDUE</span>
                        )}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
                      background: t.status === 'Closed' ? '#f1f5f9' : '#eff6ff',
                      color: t.status === 'Closed' ? '#64748b' : '#1d4ed8',
                    }}>{t.status}</span>
                  </div>

                  {/* IOW Assignment */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                    <Users size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
                    <select
                      className="rail-input"
                      style={{ flex: 1, padding: '7px 10px', fontSize: 12 }}
                      value={assigning[t.id] ?? t.assigned_iow ?? ''}
                      onChange={e => setAssigning(a => ({ ...a, [t.id]: e.target.value }))}
                    >
                      <option value="">— Assign IOW —</option>
                      {iows.map(iow => (
                        <option key={iow.pf_no} value={iow.pf_no}>{iow.name} ({iow.pf_no})</option>
                      ))}
                    </select>
                    <button
                      onClick={() => assignTicket(t.id, assigning[t.id] || t.assigned_iow || '')}
                      disabled={!(assigning[t.id] || t.assigned_iow)}
                      style={{
                        background: '#7c3aed', color: 'white', border: 'none', borderRadius: 9,
                        padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                        opacity: !(assigning[t.id] || t.assigned_iow) ? 0.4 : 1,
                      }}
                    >
                      {t.assigned_iow ? '↺ Reassign' : '+ Assign'}
                    </button>
                  </div>
                  {t.assigned_iow && (
                    <p style={{ margin: '6px 0 0', fontSize: 11, color: '#059669', fontWeight: 600 }}>
                      ✅ Currently assigned to: {iows.find(i => i.pf_no === t.assigned_iow)?.name || t.assigned_iow}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* WORKLOAD DISTRIBUTION */}
        {activeTab === 'workload' && (
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>IOW Workload Distribution</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>Real-time ticket load per field officer</p>
            </div>
            {iows.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No IOWs registered in the system yet.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['IOW Name', 'PF No', 'Total', 'Open', 'Overdue', 'Load'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {iows.map(iow => {
                    const w = workload[iow.pf_no];
                    const loadPct = w ? Math.min(100, (w.open / Math.max(1, w.total)) * 100) : 0;
                    return (
                      <tr key={iow.pf_no} style={{ borderBottom: '1px solid #f8fafc' }}>
                        <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{iow.name}</td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{iow.pf_no}</td>
                        <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: 700, color: '#1a56db' }}>{w?.total || 0}</td>
                        <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: 700, color: '#d97706' }}>{w?.open || 0}</td>
                        <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: 700, color: (w?.overdue || 0) > 0 ? '#dc2626' : '#10b981' }}>{w?.overdue || 0}</td>
                        <td style={{ padding: '12px 14px', minWidth: 120 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${loadPct}%`, borderRadius: 999, background: loadPct > 80 ? '#ef4444' : loadPct > 50 ? '#f97316' : '#10b981', transition: 'width 0.5s ease' }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', width: 32 }}>{Math.round(loadPct)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* EXTENSION REQUESTS */}
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
                      <p style={{ margin: '0 0 3px', fontWeight: 700, fontSize: 14, color: '#1e293b' }}>
                        Ticket #{req.ticket_id} · {req.ticket?.category} — {req.ticket?.sub_category}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>IOW: <strong>{req.iow?.name}</strong> · Requesting +{req.requested_hours} hours</p>
                    </div>
                    <span style={{ fontSize: 12, color: '#7c3aed', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 6, padding: '3px 10px', fontWeight: 600 }}>PENDING</span>
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
      </main>
    </div>
  );
}
