import React, { useState, useEffect } from 'react';
import { 
  Shield, Key, Users, Settings, LogOut, Ticket, Megaphone as Broadcast, 
  Activity, Eye, Edit2, Trash2, CheckCircle, XCircle, Search, Filter, 
  Download, AlertTriangle, Power, Server, Clock, Database, Lock
} from 'lucide-react';
import EmployeeDashboard from './EmployeeDashboard';
import IOWDashboard from './IOWDashboard';
import SSEDashboard from './SSEDashboard';
import DRMDashboard from './DRMDashboard';
import { auth } from '../firebase';

export default function AdminDashboard({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'tickets' | 'requests' | 'settings' | 'preview'>('overview');
  const [impersonateRole, setImpersonateRole] = useState<'Employee' | 'IOW' | 'SSE' | 'DRM'>('DRM');
  
  const [users, setUsers] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [nameRequests, setNameRequests] = useState<any[]>([]);
  const [pins, setPins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter States
  const [userSearch, setUserSearch] = useState('');
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState('All');
  
  // Settings States
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [urgentBanner, setUrgentBanner] = useState(false);

  useEffect(() => {
    if (activeTab !== 'preview') fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [uRes, pRes, nRes, tRes] = await Promise.all([
        fetch('/api/admin/users').then(r => r.json()),
        fetch('/api/admin/pins').then(r => r.json()),
        fetch('/api/admin/name-change-requests').then(r => r.json()),
        fetch('/api/tickets?role=Admin').then(r => r.json()),
      ]);
      setUsers(uRes.users || []);
      setPins(pRes.pins || []);
      setNameRequests(nRes.requests || []);
      setTickets(tRes.tickets || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    onLogout();
  };

  // User Management Actions
  const handleUpdateRole = async (pf: string, role: string) => {
    await fetch(`/api/admin/users/${pf}/role`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
    fetchData();
  };
  const handleUpdateName = async (pf: string, name: string) => {
    await fetch(`/api/admin/users/${pf}/name`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, admin_pf: user.pf_no }) });
    fetchData();
  };
  const exportUsersCSV = () => {
    const csv = ['PF,Name,Email,Role,Code,Department,HQ'].join(',') + '\n' + users.map(u => `${u.pf_no},${u.name},${u.email||''},${u.role},${u.unique_code||''},${u.department||''},${u.hq||''}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'railawaas_users.csv'; a.click();
  };

  // Ticket Command Actions
  const handleDeleteTicket = async (id: string) => {
    if (!confirm('CRITICAL WARNING: Permanently delete this ticket and all its audit logs?')) return;
    await fetch(`/api/admin/tickets/${id}`, { method: 'DELETE' });
    fetchData();
  };
  const handleForceUpdateTicket = async (id: string, field: string, value: string) => {
    await fetch(`/api/admin/tickets/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: value }) });
    fetchData();
  };
  const exportTicketsCSV = () => {
    const csv = ['ID,Status,Priority,Category,Assigned IOW,Created'].join(',') + '\n' + tickets.map(t => `${t.id},${t.status},${t.priority},${t.category},${t.assigned_iow||''},${t.created_at}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'railawaas_tickets.csv'; a.click();
  };

  // Request Actions
  const handleNameRequest = async (id: string, status: string) => {
    await fetch(`/api/admin/name-change/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, admin_pf: user.pf_no }) });
    fetchData();
  };

  // Broadcast Actions
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const handleSendBroadcast = async () => {
    await fetch('/api/admin/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: broadcastTitle, body: broadcastBody, sent_by: user.pf_no }) });
    alert('Broadcast Sent Globally!');
    setBroadcastTitle(''); setBroadcastBody('');
  };

  // Preview Mode
  if (activeTab === 'preview') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#020617', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 9999 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ animation: 'pulse 2s infinite', display: 'flex', alignItems: 'center', gap: 6, color: '#fca5a5' }}>
              <Eye size={20} /> <span style={{ fontWeight: 800, letterSpacing: 1 }}>IMPERSONATION ACTIVE</span>
            </div>
            <div style={{ height: 24, width: 1, background: 'rgba(255,255,255,0.2)' }} />
            <span style={{ fontSize: 13, color: '#94a3b8' }}>Viewing as:</span>
            <select className="rail-input" style={{ background: '#1e293b', color: 'white', border: '1px solid #334155', padding: '6px 12px', height: 'auto', fontWeight: 600 }} value={impersonateRole} onChange={e => setImpersonateRole(e.target.value as any)}>
              <option value="Employee">Employee Dashboard</option>
              <option value="IOW">IOW Dashboard</option>
              <option value="SSE">SSE Dashboard</option>
              <option value="DRM">DRM Dashboard</option>
            </select>
          </div>
          <button onClick={() => setActiveTab('overview')} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <XCircle size={16} /> Exit Preview
          </button>
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          {impersonateRole === 'Employee' && <EmployeeDashboard user={{ ...user, role: 'Employee' }} onLogout={() => setActiveTab('overview')} />}
          {impersonateRole === 'IOW' && <IOWDashboard user={{ ...user, role: 'IOW' }} onLogout={() => setActiveTab('overview')} />}
          {impersonateRole === 'SSE' && <SSEDashboard user={{ ...user, role: 'SSE' }} onLogout={() => setActiveTab('overview')} />}
          {impersonateRole === 'DRM' && <DRMDashboard user={{ ...user, role: 'DRM' }} onLogout={() => setActiveTab('overview')} />}
        </div>
      </div>
    );
  }

  // Filtered Data
  const filteredUsers = users.filter(u => u.name?.toLowerCase().includes(userSearch.toLowerCase()) || u.pf_no?.includes(userSearch) || u.unique_code?.includes(userSearch));
  const filteredTickets = tickets.filter(t => (ticketStatusFilter === 'All' || t.status === ticketStatusFilter) && (t.id.includes(ticketSearch) || t.category.toLowerCase().includes(ticketSearch.toLowerCase())));

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex' }}>
      
      {/* SIDEBAR */}
      <div style={{ width: 280, background: '#020617', borderRight: '1px solid #1e293b', color: 'white', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)', p: 8, borderRadius: 10, display: 'flex', padding: 8, boxShadow: '0 0 20px rgba(239,68,68,0.4)' }}>
              <Shield size={22} color="white" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, letterSpacing: '-0.5px', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', color: 'transparent' }}>Master Admin</h1>
              <p style={{ margin: 0, fontSize: 11, color: '#fca5a5', fontWeight: 600 }}>GOD MODE ACTIVE</p>
            </div>
          </div>
          <div style={{ background: '#1e293b', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
            <span>{user.name}</span>
            <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{user.pf_no}</span>
          </div>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 4, flex: 1, overflowY: 'auto' }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: '#475569', letterSpacing: 1.5, margin: '10px 0 6px 12px' }}>COMMAND CENTER</p>
          {[
            { id: 'overview', icon: Activity, label: 'System Analytics' },
            { id: 'users', icon: Users, label: 'User Directory' },
            { id: 'tickets', icon: Ticket, label: 'Global Tickets' },
            { id: 'requests', icon: Edit2, label: 'Pending Requests' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              background: activeTab === tab.id ? 'linear-gradient(to right, rgba(56,189,248,0.15), transparent)' : 'transparent',
              color: activeTab === tab.id ? '#38bdf8' : '#94a3b8',
              border: 'none', borderLeft: activeTab === tab.id ? '3px solid #38bdf8' : '3px solid transparent', 
              borderRadius: '0 8px 8px 0', cursor: 'pointer', fontWeight: 600, fontSize: 14, textAlign: 'left',
              transition: 'all 0.2s'
            }}>
              <tab.icon size={18} /> {tab.label}
            </button>
          ))}
          
          <p style={{ fontSize: 10, fontWeight: 800, color: '#475569', letterSpacing: 1.5, margin: '24px 0 6px 12px' }}>SYSTEM TOOLS</p>
          {[
            { id: 'settings', icon: Settings, label: 'Settings & Comms' },
            { id: 'preview', icon: Eye, label: 'Impersonate Dashboards' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              background: activeTab === tab.id ? 'linear-gradient(to right, rgba(56,189,248,0.15), transparent)' : 'transparent',
              color: activeTab === tab.id ? '#38bdf8' : '#94a3b8',
              border: 'none', borderLeft: activeTab === tab.id ? '3px solid #38bdf8' : '3px solid transparent', 
              borderRadius: '0 8px 8px 0', cursor: 'pointer', fontWeight: 600, fontSize: 14, textAlign: 'left',
              transition: 'all 0.2s'
            }}>
              <tab.icon size={18} /> {tab.label}
            </button>
          ))}
        </div>

        <div style={{ padding: 20, borderTop: '1px solid #1e293b' }}>
          <button onClick={handleLogout} className="btn-ghost" style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: 8, color: '#f87171', background: 'rgba(248,113,113,0.1)' }}>
            <Power size={16} /> Terminate Session
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div style={{ flex: 1, padding: 40, overflowY: 'auto', background: '#0f172a' }}>
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="animate-fade-in-up">
            <h2 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 800, color: 'white' }}>System Analytics</h2>
            <p style={{ color: '#94a3b8', margin: '0 0 32px' }}>Real-time overview of the RailAwaas Care infrastructure.</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginBottom: 32 }}>
              <div style={{ background: 'linear-gradient(145deg, #1e293b, #0f172a)', padding: 24, borderRadius: 20, border: '1px solid #334155', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Users color="#38bdf8" size={24} />
                  <span style={{ background: 'rgba(56,189,248,0.2)', color: '#38bdf8', padding: '4px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>LIVE</span>
                </div>
                <p style={{ margin: '0 0 4px', fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>TOTAL USERS</p>
                <div style={{ fontSize: 40, fontWeight: 900, color: 'white' }}>{users.length}</div>
              </div>
              <div style={{ background: 'linear-gradient(145deg, #1e293b, #0f172a)', padding: 24, borderRadius: 20, border: '1px solid #334155', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Ticket color="#818cf8" size={24} />
                  <span style={{ background: 'rgba(129,140,248,0.2)', color: '#818cf8', padding: '4px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>ALL TIME</span>
                </div>
                <p style={{ margin: '0 0 4px', fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>TOTAL TICKETS</p>
                <div style={{ fontSize: 40, fontWeight: 900, color: 'white' }}>{tickets.length}</div>
              </div>
              <div style={{ background: 'linear-gradient(145deg, #1e293b, #0f172a)', padding: 24, borderRadius: 20, border: '1px solid #334155', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Activity color="#fbbf24" size={24} />
                  <span style={{ background: 'rgba(251,191,36,0.2)', color: '#fbbf24', padding: '4px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>ACTION REQ</span>
                </div>
                <p style={{ margin: '0 0 4px', fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>ACTIVE TICKETS</p>
                <div style={{ fontSize: 40, fontWeight: 900, color: '#fbbf24' }}>{tickets.filter(t => t.status !== 'Closed').length}</div>
              </div>
              <div style={{ background: 'linear-gradient(145deg, #1e293b, #0f172a)', padding: 24, borderRadius: 20, border: '1px solid #334155', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <AlertTriangle color="#ef4444" size={24} />
                  <span style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', padding: '4px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>URGENT</span>
                </div>
                <p style={{ margin: '0 0 4px', fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>ESCALATED</p>
                <div style={{ fontSize: 40, fontWeight: 900, color: '#ef4444' }}>{tickets.filter(t => t.urgency_escalated).length}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div style={{ background: '#1e293b', borderRadius: 20, padding: 24, border: '1px solid #334155' }}>
                <h3 style={{ margin: '0 0 16px', color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}><Server size={18} color="#10b981" /> Server Health</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 13 }}><span>Database Connection</span> <span style={{ color: '#10b981', fontWeight: 700 }}>🟢 Stable</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 13 }}><span>API Response Time</span> <span style={{ color: 'white', fontWeight: 700 }}>42ms</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 13 }}><span>Storage Usage</span> <span style={{ color: 'white', fontWeight: 700 }}>14%</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 13 }}><span>Background Cron Jobs</span> <span style={{ color: '#10b981', fontWeight: 700 }}>🟢 Active</span></div>
                </div>
              </div>
              <div style={{ background: '#1e293b', borderRadius: 20, padding: 24, border: '1px solid #334155' }}>
                <h3 style={{ margin: '0 0 16px', color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}><Database size={18} color="#a855f7" /> Data Export</h3>
                <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 20 }}>Generate complete CSV dumps of the entire database for backup and external analysis.</p>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button onClick={exportUsersCSV} className="btn-primary" style={{ background: '#3b82f6', flex: 1, display: 'flex', justifyContent: 'center', gap: 8 }}><Download size={16} /> Export Users CSV</button>
                  <button onClick={exportTicketsCSV} className="btn-primary" style={{ background: '#8b5cf6', flex: 1, display: 'flex', justifyContent: 'center', gap: 8 }}><Download size={16} /> Export Tickets CSV</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* USER MANAGEMENT TAB */}
        {activeTab === 'users' && (
          <div className="animate-fade-in-up">
            <h2 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 800, color: 'white' }}>User Directory</h2>
            <p style={{ color: '#94a3b8', margin: '0 0 24px' }}>Global access to all user profiles, roles, and identity codes.</p>
            
            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: 16, top: 14 }} />
                <input className="rail-input" style={{ background: '#1e293b', border: '1px solid #334155', color: 'white', paddingLeft: 44 }} placeholder="Search by name, PF, or RAIL-CODE..." value={userSearch} onChange={e => setUserSearch(e.target.value)} />
              </div>
            </div>

            <div style={{ background: '#1e293b', borderRadius: 16, border: '1px solid #334155', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, color: '#cbd5e1' }}>
                <thead style={{ background: '#0f172a', borderBottom: '2px solid #334155' }}>
                  <tr>
                    <th style={{ padding: '16px', textAlign: 'left', fontWeight: 600 }}>Name & Dept</th>
                    <th style={{ padding: '16px', textAlign: 'left', fontWeight: 600 }}>PF Number</th>
                    <th style={{ padding: '16px', textAlign: 'left', fontWeight: 600 }}>Unique Code</th>
                    <th style={{ padding: '16px', textAlign: 'left', fontWeight: 600 }}>Role</th>
                    <th style={{ padding: '16px', textAlign: 'left', fontWeight: 600 }}>Admin Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.pf_no} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input className="rail-input" style={{ background: 'transparent', border: 'none', color: 'white', fontWeight: 700, padding: 0, height: 'auto' }} defaultValue={u.name} onBlur={e => e.target.value !== u.name && handleUpdateName(u.pf_no, e.target.value)} />
                          {u.is_on_leave && <span style={{ background: '#f59e0b', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>ON LEAVE</span>}
                        </div>
                        <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>{u.department || 'No Dept'} · {u.designation || 'No Desig'}</div>
                      </td>
                      <td style={{ padding: '16px', fontFamily: 'monospace', color: '#94a3b8' }}>{u.pf_no}</td>
                      <td style={{ padding: '16px' }}>
                        <span style={{ background: '#0f172a', border: '1px solid #334155', padding: '4px 8px', borderRadius: 6, fontFamily: 'monospace', color: '#38bdf8', fontWeight: 700 }}>{u.unique_code || 'NONE'}</span>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <select className="rail-input" style={{ background: '#0f172a', border: '1px solid #334155', color: 'white', padding: '6px 10px', height: 'auto', fontSize: 12, borderRadius: 6 }} value={u.role} onChange={e => handleUpdateRole(u.pf_no, e.target.value)}>
                          <option value="Employee">Employee</option>
                          <option value="IOW">IOW</option>
                          <option value="SSE">SSE</option>
                          <option value="DRM">DRM</option>
                          <option value="Admin">Admin</option>
                        </select>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {u.role === 'IOW' && (
                            <button onClick={() => fetch(`/api/admin/users/${u.pf_no}/leave`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_on_leave: !u.is_on_leave }) }).then(fetchData)} style={{ background: 'transparent', border: `1px solid ${u.is_on_leave ? '#10b981' : '#f59e0b'}`, color: u.is_on_leave ? '#10b981' : '#f59e0b', padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                              {u.is_on_leave ? 'End Leave' : 'Force Leave'}
                            </button>
                          )}
                          <button style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Suspend</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TICKET COMMAND TAB */}
        {activeTab === 'tickets' && (
          <div className="animate-fade-in-up">
            <h2 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 800, color: 'white' }}>Global Ticket Command</h2>
            <p style={{ color: '#94a3b8', margin: '0 0 24px' }}>Absolute control over all tickets. Force status changes, reassign IOWs, or delete spam.</p>

            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: 16, top: 14 }} />
                <input className="rail-input" style={{ background: '#1e293b', border: '1px solid #334155', color: 'white', paddingLeft: 44 }} placeholder="Search tickets by ID or Category..." value={ticketSearch} onChange={e => setTicketSearch(e.target.value)} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#1e293b', border: '1px solid #334155', padding: '0 16px', borderRadius: 12 }}>
                <Filter size={16} color="#94a3b8" />
                <select style={{ background: 'transparent', color: 'white', border: 'none', outline: 'none', fontSize: 13, cursor: 'pointer' }} value={ticketStatusFilter} onChange={e => setTicketStatusFilter(e.target.value)}>
                  <option value="All">All Statuses</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Seen">Seen</option>
                  <option value="In-Progress">In-Progress</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
            </div>

            <div style={{ background: '#1e293b', borderRadius: 16, border: '1px solid #334155', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, color: '#cbd5e1' }}>
                <thead style={{ background: '#0f172a', borderBottom: '2px solid #334155' }}>
                  <tr>
                    <th style={{ padding: '16px', textAlign: 'left', fontWeight: 600 }}>Ticket ID & Category</th>
                    <th style={{ padding: '16px', textAlign: 'left', fontWeight: 600 }}>Creator PF</th>
                    <th style={{ padding: '16px', textAlign: 'left', fontWeight: 600 }}>Assigned IOW</th>
                    <th style={{ padding: '16px', textAlign: 'left', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '16px', textAlign: 'left', fontWeight: 600 }}>Priority</th>
                    <th style={{ padding: '16px', textAlign: 'left', fontWeight: 600 }}>Danger Zone</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontFamily: 'monospace', color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>#{t.id.slice(-6).toUpperCase()}</div>
                        <div style={{ fontWeight: 700, color: 'white' }}>{t.category}</div>
                        {t.urgency_escalated && <span style={{ color: '#ef4444', fontSize: 10, fontWeight: 700 }}>ESCALATED</span>}
                      </td>
                      <td style={{ padding: '16px', fontFamily: 'monospace', color: '#cbd5e1' }}>{t.pf_no}</td>
                      <td style={{ padding: '16px' }}>
                        <input className="rail-input" style={{ background: '#0f172a', border: '1px solid #334155', color: 'white', padding: '6px 10px', height: 'auto', fontSize: 12, width: 120, fontFamily: 'monospace' }} placeholder="IOW PF..." defaultValue={t.assigned_iow || ''} onBlur={e => e.target.value !== t.assigned_iow && handleForceUpdateTicket(t.id, 'assigned_iow', e.target.value)} />
                      </td>
                      <td style={{ padding: '16px' }}>
                        <select className="rail-input" style={{ background: '#0f172a', border: '1px solid #334155', color: 'white', padding: '6px 10px', height: 'auto', fontSize: 12, borderRadius: 6 }} value={t.status} onChange={e => handleForceUpdateTicket(t.id, 'status', e.target.value)}>
                          <option value="Submitted">Submitted</option>
                          <option value="Seen">Seen</option>
                          <option value="In-Progress">In-Progress</option>
                          <option value="Pending-Material">Pending-Material</option>
                          <option value="Resolved">Resolved</option>
                          <option value="Closed">Closed</option>
                        </select>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <select className="rail-input" style={{ background: '#0f172a', border: '1px solid #334155', color: 'white', padding: '6px 10px', height: 'auto', fontSize: 12, borderRadius: 6 }} value={t.priority} onChange={e => handleForceUpdateTicket(t.id, 'priority', e.target.value)}>
                          <option value="Critical">Critical</option>
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <button onClick={() => handleDeleteTicket(t.id)} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#ef4444'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}>
                          <Trash2 size={14} /> Obliterate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PENDING REQUESTS TAB */}
        {activeTab === 'requests' && (
          <div className="animate-fade-in-up">
            <h2 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 800, color: 'white' }}>Pending Requests</h2>
            <p style={{ color: '#94a3b8', margin: '0 0 24px' }}>Approve or reject employee name changes and other system requests.</p>
            
            <h3 style={{ margin: '0 0 16px', color: 'white', fontSize: 16 }}>Name Change Approvals</h3>
            <div style={{ display: 'grid', gap: 16 }}>
              {nameRequests.filter(r => r.status === 'Pending').map(r => (
                <div key={r.id} style={{ background: '#1e293b', padding: 24, borderRadius: 16, border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <span style={{ color: '#ef4444', textDecoration: 'line-through', fontWeight: 600 }}>{r.old_name}</span>
                      <span style={{ color: '#94a3b8' }}>→</span>
                      <span style={{ color: '#10b981', fontWeight: 800, fontSize: 18 }}>{r.new_name}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: '#cbd5e1' }}><span style={{ color: '#64748b' }}>PF Number:</span> {r.user_pf} <span style={{ color: '#64748b', margin: '0 8px' }}>|</span> <span style={{ color: '#64748b' }}>Reason:</span> "{r.reason}"</p>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => handleNameRequest(r.id, 'Approved')} className="btn-primary" style={{ background: '#10b981', display: 'flex', gap: 6, alignItems: 'center' }}><CheckCircle size={16} /> Approve Change</button>
                    <button onClick={() => handleNameRequest(r.id, 'Rejected')} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: '10px 20px', borderRadius: 12, color: '#ef4444', cursor: 'pointer', fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}><XCircle size={16} /> Reject</button>
                  </div>
                </div>
              ))}
              {nameRequests.filter(r => r.status === 'Pending').length === 0 && (
                <div style={{ padding: 40, background: '#1e293b', borderRadius: 16, border: '1px dashed #334155', textAlign: 'center', color: '#64748b' }}>
                  <CheckCircle size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>No pending name change requests.</p>
                </div>
              )}
            </div>
            
            <h3 style={{ margin: '40px 0 16px', color: 'white', fontSize: 16 }}>SLA Extension Requests</h3>
            <div style={{ padding: 40, background: '#1e293b', borderRadius: 16, border: '1px dashed #334155', textAlign: 'center', color: '#64748b' }}>
              <p style={{ margin: 0, fontWeight: 600 }}>No pending SLA extension requests from IOWs.</p>
            </div>
          </div>
        )}

        {/* SETTINGS & COMMS TAB */}
        {activeTab === 'settings' && (
          <div className="animate-fade-in-up">
            <h2 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 800, color: 'white' }}>Settings & Communications</h2>
            <p style={{ color: '#94a3b8', margin: '0 0 32px' }}>Manage global system settings, PINs, and send broadcast alerts.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ background: 'linear-gradient(145deg, #1e293b, #0f172a)', padding: 24, borderRadius: 20, border: '1px solid #334155', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                  <h3 style={{ margin: '0 0 20px', color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}><Broadcast size={20} color="#3b82f6" /> Global Broadcast System</h3>
                  <div style={{ marginBottom: 16 }}>
                    <label className="rail-label" style={{ color: '#94a3b8' }}>Broadcast Title</label>
                    <input className="rail-input" style={{ background: '#0f172a', border: '1px solid #334155', color: 'white' }} value={broadcastTitle} onChange={e => setBroadcastTitle(e.target.value)} placeholder="e.g. Server Maintenance Notice" />
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label className="rail-label" style={{ color: '#94a3b8' }}>Message Body</label>
                    <textarea className="rail-input" style={{ background: '#0f172a', border: '1px solid #334155', color: 'white' }} value={broadcastBody} onChange={e => setBroadcastBody(e.target.value)} placeholder="Type your message here. This will pop up for all users..." rows={4} />
                  </div>
                  <button onClick={handleSendBroadcast} disabled={!broadcastTitle || !broadcastBody} className="btn-primary" style={{ background: '#3b82f6', width: '100%', display: 'flex', justifyContent: 'center', gap: 8, padding: 14 }}>
                    <Broadcast size={18} /> Transmit Globally
                  </button>
                </div>

                <div style={{ background: '#1e293b', padding: 24, borderRadius: 20, border: '1px solid #334155' }}>
                  <h3 style={{ margin: '0 0 20px', color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}><Power size={20} color="#ef4444" /> System Controls</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#0f172a', borderRadius: 12, marginBottom: 12, border: '1px solid #334155' }}>
                    <div>
                      <p style={{ margin: '0 0 4px', fontWeight: 700, color: 'white' }}>Maintenance Mode</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Locks out all non-admin users.</p>
                    </div>
                    <button onClick={() => setMaintenanceMode(!maintenanceMode)} style={{ background: maintenanceMode ? '#ef4444' : '#334155', border: 'none', padding: '8px 16px', borderRadius: 20, color: 'white', fontWeight: 700, cursor: 'pointer', transition: '0.2s' }}>
                      {maintenanceMode ? 'ACTIVE' : 'OFF'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#0f172a', borderRadius: 12, border: '1px solid #334155' }}>
                    <div>
                      <p style={{ margin: '0 0 4px', fontWeight: 700, color: 'white' }}>Global Urgent Banner</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Shows a red warning banner at the top of all apps.</p>
                    </div>
                    <button onClick={() => setUrgentBanner(!urgentBanner)} style={{ background: urgentBanner ? '#f59e0b' : '#334155', border: 'none', padding: '8px 16px', borderRadius: 20, color: 'white', fontWeight: 700, cursor: 'pointer', transition: '0.2s' }}>
                      {urgentBanner ? 'ACTIVE' : 'OFF'}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ background: '#1e293b', padding: 24, borderRadius: 20, border: '1px solid #334155', height: 'fit-content' }}>
                <h3 style={{ margin: '0 0 20px', color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}><Lock size={20} color="#10b981" /> Role Authentication PINs</h3>
                <p style={{ margin: '0 0 24px', fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>Configure the secret PINs required for users to automatically claim high-level roles during their initial profile setup.</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {['IOW', 'SSE', 'DRM', 'ADE'].map(role => {
                    const existingPin = pins.find(p => p.role === role)?.pin || 'Not Set';
                    return (
                      <div key={role} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#0f172a', borderRadius: 12, border: '1px solid #334155' }}>
                        <span style={{ fontWeight: 700, color: 'white', fontSize: 15 }}>{role} PIN</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 900, color: existingPin === 'Not Set' ? '#64748b' : '#10b981', fontSize: 18, letterSpacing: 4 }}>{existingPin}</span>
                          <button onClick={() => {
                            const newPin = prompt(`Enter new PIN for ${role}:`);
                            if (newPin && newPin.length >= 4) {
                              fetch('/api/admin/pins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, pin: newPin }) }).then(fetchData);
                            } else if (newPin) alert('PIN must be at least 4 chars.');
                          }} style={{ background: 'transparent', border: '1px solid #475569', color: '#cbd5e1', padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Edit</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
