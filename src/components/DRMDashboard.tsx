import React, { useState, useEffect, useCallback } from 'react';
import { LogOut, TrendingUp, BarChart2, Download, RefreshCw, Search, Star, Users, AlertTriangle, MapPin, Database, Activity } from 'lucide-react';
import { logout } from '../firebase';
import NotificationBell from './NotificationBell';

interface TicketRow { id: string; category: string; sub_category: string; status: string; priority: string; flag_color: string; pf_no: string; assigned_iow?: string; SLA_deadline: string; created_at: string; major_overhaul?: boolean; urgency_escalated?: boolean; estimated_cost?: number; rating?: number; user?: { name: string; pf_no: string; unique_code?: string }; iow?: { name: string; pf_no: string; unique_code?: string }; }
interface Report { period?: { from: string; to: string }; totalTickets: number; closedTickets: number; slaBreaches: number; redFlags: number; majorOverhauls: number; categoryBreakdown: Record<string, number>; iowStats: Record<string, { total: number; closed: number; breached: number; name?: string; avgRating?: number }>; totalCost: number; avgRating: number; slaComplianceRate: number; }
interface IOW { pf_no: string; name: string; designation: string; average_rating?: number; unique_code?: string; }

const CATEGORY_COLORS: Record<string, string> = { Civil: '#3b82f6', Electrical: '#f59e0b', Sanitary: '#10b981', Carpentry: '#8b5cf6', Painting: '#ec4899' };

function HealthScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 45;
  const dashOffset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : 'D';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="donut-chart" style={{ width: 110, height: 110 }}>
        <svg width="110" height="110" viewBox="0 0 110 110">
          <circle cx="55" cy="55" r="45" fill="none" stroke="#f1f5f9" strokeWidth="10" />
          <circle cx="55" cy="55" r="45" fill="none" stroke={color} strokeWidth="10"
            strokeDasharray={circumference} strokeDashoffset={dashOffset}
            strokeLinecap="round" style={{ transform: 'rotate(-90deg)', transformOrigin: '55px 55px', transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)' }} />
        </svg>
        <div className="donut-label">
          <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color }}>{score}</p>
          <p style={{ margin: 0, fontSize: 11, color, fontWeight: 700 }}>Grade {grade}</p>
        </div>
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>Division Health Score</p>
    </div>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ height: 8, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden', flex: 1, minWidth: 80 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 999, transition: 'width 0.6s ease' }} />
    </div>
  );
}

export default function DRMDashboard({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [report, setReport] = useState<Report | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<any>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [iowRatings, setIowRatings] = useState<IOW[]>([]);
  const [healthScore, setHealthScore] = useState<{ score: number; grade: string; breakdown?: any } | null>(null);
  const [costReport, setCostReport] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'tickets' | 'iow' | 'search' | 'live'>('overview');
  const [reportPeriod, setReportPeriod] = useState<'weekly' | 'monthly'>('monthly');
  const [searchQ, setSearchQ] = useState('');
  const [codeSearch, setCodeSearch] = useState('');
  const [codeResult, setCodeResult] = useState<any | null>(null);
  const [codeNotFound, setCodeNotFound] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [liveTickets, setLiveTickets] = useState<TicketRow[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, wRes, tRes, iRes, hRes, cRes, uRes] = await Promise.all([
        fetch('/api/reports/monthly'),
        fetch('/api/reports/weekly'),
        fetch('/api/tickets?role=DRM'),
        fetch('/api/reports/iow-ratings'),
        fetch('/api/reports/health-score'),
        fetch('/api/reports/cost'),
        fetch('/api/users/all-with-codes'),
      ]);
      const [rD, wD, tD, iD, hD, cD, uD] = await Promise.all([rRes.json(), wRes.json(), tRes.json(), iRes.json(), hRes.json(), cRes.json(), uRes.json()]);
      if (rD.success) setReport(rD.report);
      if (wD.success) setWeeklyReport(wD.report);
      if (tD.success) { setTickets(tD.tickets); setLiveTickets(tD.tickets.slice(0, 10)); }
      if (iD.success) setIowRatings(iD.iows);
      if (hD.success) setHealthScore(hD);
      if (cD.success) setCostReport(cD);
      if (uD.success) setAllUsers(uD.users);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const searchByCode = async () => {
    setCodeNotFound(false); setCodeResult(null);
    const res = await fetch(`/api/users/by-code/${codeSearch.toUpperCase()}`);
    const data = await res.json();
    if (data.success) setCodeResult(data.user); else setCodeNotFound(true);
  };

  // Filtered tickets for search tab
  const displayTickets = searchQ ? tickets.filter(t =>
    (t.user?.name || '').toLowerCase().includes(searchQ.toLowerCase()) ||
    t.pf_no.includes(searchQ) || t.id.includes(searchQ) ||
    t.category.toLowerCase().includes(searchQ.toLowerCase()) ||
    t.sub_category.toLowerCase().includes(searchQ.toLowerCase()) ||
    (t.user?.unique_code || '').toUpperCase().includes(searchQ.toUpperCase()) ||
    (t.iow?.name || '').toLowerCase().includes(searchQ.toLowerCase())
  ) : [];

  const activeReport = reportPeriod === 'monthly' ? report : weeklyReport;

  const downloadReport = () => {
    const r = activeReport;
    if (!r) return;
    const content = `DRM ${reportPeriod.toUpperCase()} REPORT — ${user.name} (${user.pf_no})\nGenerated: ${new Date().toLocaleString('en-IN')}\n\n${'='.repeat(60)}\nTotal Tickets: ${r.totalTickets}\nClosed: ${r.closedTickets}\nSLA Breaches: ${r.slaBreaches}\nRed Flags: ${r.redFlags || 0}\nMajor Overhauls: ${r.majorOverhauls || 0}\nSLA Compliance: ${r.slaComplianceRate || 0}%\nAvg Rating: ${r.avgRating || '—'}/5\nTotal Cost Estimate: ₹${(r.totalCost || 0).toLocaleString('en-IN')}\n\n${'='.repeat(60)}\nCATEGORY BREAKDOWN:\n${Object.entries(r.categoryBreakdown || {}).map(([k, v]) => `  ${k}: ${v} tickets`).join('\n')}\n\n${'='.repeat(60)}\nIOW PERFORMANCE:\n${Object.entries(r.iowStats || {}).map(([pf, s]) => { const sv = s as { total: number; closed: number; breached: number; name?: string; avgRating?: number }; return `  ${sv.name || pf} (${pf}): ${sv.total} total, ${sv.closed} closed, ${sv.breached} breached${sv.avgRating ? `, ⭐${sv.avgRating}` : ''}`; }).join('\n')}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `DRM_Report_${reportPeriod}_${user.pf_no}.txt`; a.click();
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, border: '4px solid #e2e8f0', borderTopColor: '#1a56db', borderRadius: '50%', animation: 'spin-slow 0.8s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: '#64748b', fontSize: 14 }}>Loading DRM Dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className={darkMode ? 'dark-mode' : ''} style={{ minHeight: '100vh', background: darkMode ? '#0f172a' : '#f1f5f9', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        background: darkMode ? 'linear-gradient(135deg, #1e293b, #0f172a)' : 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #1a56db 100%)',
        padding: '12px 20px', boxShadow: '0 2px 16px rgba(0,0,0,0.3)',
        position: 'sticky', top: 0, zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, background: 'rgba(255,255,255,0.12)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🏛️</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: 'white', letterSpacing: '-0.5px' }}>DRM Command Center</h1>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{user.name} · {user.unique_code || user.pf_no} · Division HQ: {user.hq || 'N/A'}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Dark Mode Toggle */}
          <button onClick={() => setDarkMode(d => !d)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', color: 'white', fontSize: 16 }}>
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button onClick={fetchAll} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', color: 'white', display: 'flex' }}><RefreshCw size={16} /></button>
          <button onClick={downloadReport} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', color: 'white', display: 'flex' }}><Download size={16} /></button>
          <NotificationBell userPf={user.pf_no} />
          <button onClick={() => { logout(); onLogout(); }} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      {/* Live Ticker */}
      <div style={{ background: darkMode ? '#1e293b' : '#1a56db', padding: '6px 0', overflow: 'hidden' }}>
        <div className="ticker-track">
          <span className="ticker-content" style={{ color: 'white', fontSize: 12, fontWeight: 500 }}>
            {liveTickets.map(t => `  📋 ${t.category} · ${t.sub_category} · ${t.status} · ${t.user?.name || t.pf_no}  ·`).join(' ')}
            {` | 📊 Total: ${tickets.length} | ✅ Closed: ${tickets.filter(t => t.status === 'Closed').length} | 🚨 Overdue: ${tickets.filter(t => new Date(t.SLA_deadline) < new Date() && t.status !== 'Closed').length} | 🔴 Red Flags: ${tickets.filter(t => t.flag_color === 'Red').length} |`}
          </span>
        </div>
      </div>

      {/* Period Toggle */}
      <div style={{ padding: '10px 20px 0', display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Report Period:</span>
        {(['weekly', 'monthly'] as const).map(p => (
          <button key={p} onClick={() => setReportPeriod(p)} style={{
            padding: '5px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: `1.5px solid ${reportPeriod === p ? '#1a56db' : '#e2e8f0'}`,
            background: reportPeriod === p ? '#1a56db' : 'transparent',
            color: reportPeriod === p ? 'white' : '#64748b',
          }}>{p === 'weekly' ? '7 Days' : '30 Days'}</button>
        ))}
        <button onClick={downloadReport} style={{ marginLeft: 'auto', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 11, color: '#1a56db', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Download size={12} /> Export PDF
        </button>
      </div>

      {/* Tabs */}
      <div style={{ padding: '8px 20px 0' }}>
        <div style={{ display: 'flex', gap: 0, background: '#f1f5f9', borderRadius: 12, padding: 4, overflowX: 'auto' }}>
          {([
            { id: 'overview', label: '📊 Overview' },
            { id: 'tickets', label: `🎫 Tickets (${tickets.length})` },
            { id: 'iow', label: `⭐ IOW Rankings` },
            { id: 'search', label: '🔍 Search' },
            { id: 'live', label: '🔴 Live Feed' },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`tab-btn ${activeTab === tab.id ? 'tab-btn-active' : ''}`} style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main style={{ flex: 1, padding: '12px 20px 20px', overflowY: 'auto' }}>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Health Score + KPI Cards */}
            <div style={{ background: 'white', borderRadius: 20, border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              {healthScore && <HealthScoreRing score={healthScore.score} />}
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Total Tickets', value: activeReport?.totalTickets || 0, color: '#1a56db' },
                    { label: 'Closed', value: activeReport?.closedTickets || 0, color: '#10b981' },
                    { label: 'SLA Breaches', value: activeReport?.slaBreaches || 0, color: '#dc2626' },
                    { label: 'Major Overhauls', value: activeReport?.majorOverhauls || 0, color: '#7c3aed' },
                    { label: 'SLA Compliance', value: `${activeReport?.slaComplianceRate || 0}%`, color: '#059669' },
                    { label: 'Avg Rating', value: activeReport?.avgRating ? `${activeReport.avgRating}⭐` : 'N/A', color: '#f59e0b' },
                  ].map(s => (
                    <div key={s.label} style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px', border: '1px solid #f1f5f9' }}>
                      <p style={{ margin: '0 0 2px', fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
                      <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Cost Overview */}
            {costReport && (
              <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: '16px 20px' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>💰 Budget Overview</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  <div style={{ background: '#ecfdf5', borderRadius: 10, padding: '12px', border: '1px solid #a7f3d0' }}>
                    <p style={{ margin: '0 0 2px', fontSize: 11, color: '#059669', fontWeight: 700 }}>TOTAL ESTIMATED</p>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#059669' }}>₹{costReport.totalEstimated?.toLocaleString('en-IN') || 0}</p>
                  </div>
                  <div style={{ background: '#eff6ff', borderRadius: 10, padding: '12px', border: '1px solid #bfdbfe' }}>
                    <p style={{ margin: '0 0 2px', fontSize: 11, color: '#1d4ed8', fontWeight: 700 }}>ACTUAL SPENT</p>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#1d4ed8' }}>₹{costReport.totalActual?.toLocaleString('en-IN') || 0}</p>
                  </div>
                </div>
                <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#374151' }}>By Category</h4>
                {Object.entries(costReport.byCategory || {}).map(([cat, cost]: any) => {
                  const max = Math.max(...Object.values(costReport.byCategory) as number[]);
                  return (
                    <div key={cat} style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', width: 90, flexShrink: 0 }}>{cat}</span>
                      <MiniBar value={cost} max={max} color={CATEGORY_COLORS[cat] || '#94a3b8'} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', width: 80, textAlign: 'right', flexShrink: 0 }}>₹{cost.toLocaleString('en-IN')}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Category Breakdown */}
            {activeReport?.categoryBreakdown && (
              <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: '16px 20px' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>📊 Category Breakdown</h3>
                {Object.entries(activeReport.categoryBreakdown).map(([cat, countRaw]) => {
                  const count = countRaw as number;
                  const max = Math.max(...Object.values(activeReport.categoryBreakdown).map(v => v as number));
                  return (
                    <div key={cat} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, color: CATEGORY_COLORS[cat] || '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 10, height: 10, background: CATEGORY_COLORS[cat] || '#94a3b8', borderRadius: 3, display: 'inline-block' }} />
                          {cat}
                        </span>
                        <span style={{ fontWeight: 600, color: '#475569' }}>{count} tickets ({Math.round((count / activeReport.totalTickets) * 100)}%)</span>
                      </div>
                      <MiniBar value={count} max={max} color={CATEGORY_COLORS[cat] || '#94a3b8'} />
                    </div>
                  );
                })}

              </div>
            )}

            {/* Urgency Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { label: '🔴 Red Flags', value: tickets.filter(t => t.flag_color === 'Red').length, color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
                { label: '🟠 Orange', value: tickets.filter(t => t.flag_color === 'Orange').length, color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
                { label: '🆘 Urgencies', value: tickets.filter(t => t.urgency_escalated).length, color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: '14px 10px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</p>
                  <p style={{ margin: 0, fontSize: 11, color: s.color, fontWeight: 700 }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* SLA Compliance Trend Ring */}
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: '16px 20px' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>📈 SLA Compliance Rate</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div className="donut-chart" style={{ width: 80, height: 80 }}>
                  <svg width="80" height="80" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="33" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                    <circle cx="40" cy="40" r="33" fill="none" stroke={activeReport?.slaComplianceRate >= 80 ? '#10b981' : '#f97316'} strokeWidth="8"
                      strokeDasharray={207.3} strokeDashoffset={207.3 - (activeReport?.slaComplianceRate || 0) / 100 * 207.3}
                      strokeLinecap="round" style={{ transform: 'rotate(-90deg)', transformOrigin: '40px 40px', transition: 'stroke-dashoffset 1.2s ease' }} />
                  </svg>
                  <div className="donut-label" style={{ fontSize: 14, fontWeight: 900, color: '#1e293b' }}>
                    {activeReport?.slaComplianceRate || 0}%
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 13, color: '#475569' }}>
                    <strong style={{ color: '#10b981' }}>{activeReport?.closedTickets || 0}</strong> out of <strong>{activeReport?.totalTickets || 0}</strong> tickets closed
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                    {activeReport?.slaBreaches || 0} SLA breaches this period
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TICKETS TAB */}
        {activeTab === 'tickets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 4 }}>
              {[
                { label: 'Total', val: tickets.length, color: '#1a56db' },
                { label: 'Closed', val: tickets.filter(t => t.status === 'Closed').length, color: '#10b981' },
                { label: 'Overdue', val: tickets.filter(t => new Date(t.SLA_deadline) < new Date() && t.status !== 'Closed').length, color: '#dc2626' },
                { label: 'Overhaul', val: tickets.filter(t => t.major_overhaul).length, color: '#7c3aed' },
              ].map(s => (
                <div key={s.label} style={{ background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', padding: '10px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 2px', fontSize: 18, fontWeight: 900, color: s.color }}>{s.val}</p>
                  <p style={{ margin: 0, fontSize: 9, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</p>
                </div>
              ))}
            </div>
            {tickets.sort((a, b) => {
              const flagOrder: Record<string, number> = { Red: 3, Orange: 2, Yellow: 1, None: 0 };
              return (flagOrder[b.flag_color] || 0) - (flagOrder[a.flag_color] || 0);
            }).slice(0, 50).map(t => (
              <div key={t.id} style={{
                background: 'white', borderRadius: 12, border: '1px solid #e2e8f0',
                borderLeft: `4px solid ${t.flag_color === 'Red' ? '#ef4444' : t.flag_color === 'Orange' ? '#f97316' : t.flag_color === 'Yellow' ? '#fbbf24' : '#e2e8f0'}`,
                padding: '12px 14px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 12, color: '#1e293b' }}>#{t.id.slice(-6)} · {t.category} — {t.sub_category}</span>
                    <div style={{ display: 'flex', gap: 8, marginTop: 3, fontSize: 11, color: '#64748b', flexWrap: 'wrap' }}>
                      <span>👤 {t.user?.name || t.pf_no} ({t.user?.unique_code || t.pf_no})</span>
                      {t.iow && <span>🔧 {t.iow.name} ({t.iow.unique_code || t.iow.pf_no})</span>}
                      <span>SLA: {new Date(t.SLA_deadline).toLocaleDateString('en-IN')}</span>
                      {t.estimated_cost && <span>💰 ₹{t.estimated_cost.toLocaleString()}</span>}
                      {t.rating && <span>⭐ {t.rating}/5</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>{t.status}</span>
                    {new Date(t.SLA_deadline) < new Date() && t.status !== 'Closed' && <span style={{ fontSize: 9, fontWeight: 800, color: '#dc2626', background: '#fef2f2', padding: '2px 5px', borderRadius: 3 }}>OVERDUE</span>}
                    {t.urgency_escalated && <span style={{ fontSize: 9, fontWeight: 800, color: '#dc2626', background: '#fef2f2', padding: '2px 5px', borderRadius: 3 }}>🆘</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* IOW RANKINGS TAB */}
        {activeTab === 'iow' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '14px 16px', marginBottom: 2 }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>⭐ IOW Performance Leaderboard</h3>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Ranked by employee rating + SLA compliance</p>
            </div>
            {iowRatings.map((iow, i) => {
              const stats = report?.iowStats?.[iow.pf_no];
              const slaHitRate = stats ? Math.round((stats.closed / Math.max(1, stats.total)) * 100) : 0;
              return (
                <div key={iow.pf_no} className="perf-card animate-fade-in-up" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 900, flexShrink: 0,
                    background: i === 0 ? '#fef3c7' : i === 1 ? '#f1f5f9' : i === 2 ? '#fdf3e8' : '#f8fafc',
                    color: i === 0 ? '#d97706' : i === 1 ? '#64748b' : i === 2 ? '#b45309' : '#94a3b8',
                    border: `2px solid ${i === 0 ? '#fcd34d' : i === 1 ? '#e2e8f0' : i === 2 ? '#fde68a' : '#f1f5f9'}`,
                  }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{iow.name}</p>
                        <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>PF: {iow.pf_no} · {iow.unique_code || '—'} · {iow.designation}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: '0 0 2px', fontSize: 20, fontWeight: 900, color: '#f59e0b' }}>
                          {iow.average_rating ? `${iow.average_rating}⭐` : '—'}
                        </p>
                        <p style={{ margin: 0, fontSize: 10, color: '#94a3b8' }}>Avg Rating</p>
                      </div>
                    </div>
                    {stats && (
                      <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: '#1a56db', fontWeight: 600 }}>{stats.total} total</span>
                        <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>{stats.closed} closed</span>
                        <span style={{ fontSize: 11, color: stats.breached > 0 ? '#dc2626' : '#10b981', fontWeight: 600 }}>{stats.breached} breached</span>
                        <span style={{ fontSize: 11, color: slaHitRate >= 80 ? '#10b981' : '#f97316', fontWeight: 600 }}>SLA: {slaHitRate}%</span>
                      </div>
                    )}
                    {stats && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ height: 6, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${slaHitRate}%`, background: slaHitRate >= 80 ? '#10b981' : slaHitRate >= 50 ? '#f97316' : '#ef4444', borderRadius: 999, transition: 'width 0.6s ease' }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SEARCH TAB */}
        {activeTab === 'search' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Global Ticket Search */}
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: '16px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>🔍 Global Search</h3>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: '#64748b' }}>Search tickets by employee name, PF, code, IOW, category, or ticket ID</p>
              <div className="search-input-wrap">
                <Search size={14} className="search-icon" />
                <input className="rail-input" style={{ paddingLeft: 36 }} placeholder="Search anything..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
              </div>
              {searchQ && (
                <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748b' }}>{displayTickets.length} results found</p>
              )}
            </div>
            {searchQ && displayTickets.map(t => (
              <div key={t.id} style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', borderLeft: '4px solid #1a56db', padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>#{t.id.slice(-6)} · {t.category} — {t.sub_category}</span>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, background: '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>{t.status}</span>
                </div>
                <div style={{ fontSize: 11, color: '#64748b', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span>👤 {t.user?.name || t.pf_no} ({t.pf_no}) · {t.user?.unique_code}</span>
                  {t.iow && <span>🔧 {t.iow.name} ({t.iow.pf_no}) · {t.iow.unique_code}</span>}
                  <span>📅 {new Date(t.created_at).toLocaleDateString('en-IN')}</span>
                </div>
              </div>
            ))}

            {/* Unique Code Lookup */}
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: '16px' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>🔑 Lookup by RailAwaas Code</h3>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: '#64748b' }}>Find any user by their unique RAIL-XXXX code</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="rail-input" style={{ flex: 1, letterSpacing: 2, fontFamily: 'monospace', fontWeight: 700 }} placeholder="RAIL-XXXX" value={codeSearch} onChange={e => setCodeSearch(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && searchByCode()} />
                <button onClick={searchByCode} className="btn-primary" style={{ padding: '10px 16px' }}>Search</button>
              </div>
              {codeResult && (
                <div className="animate-fade-in" style={{ marginTop: 12, background: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 38, height: 38, background: '#1a56db', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 16 }}>
                      {codeResult.name[0]}
                    </div>
                    <div>
                      <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{codeResult.name}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{codeResult.role} · PF: {codeResult.pf_no}</p>
                    </div>
                    <div style={{ marginLeft: 'auto', background: '#1a56db', padding: '4px 10px', borderRadius: 6, color: 'white', fontSize: 14, fontWeight: 900, fontFamily: 'monospace', letterSpacing: 2 }}>
                      {codeResult.unique_code}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {codeResult.department && <span>Dept: {codeResult.department} · </span>}
                    {codeResult.designation && <span>{codeResult.designation} · </span>}
                    {codeResult.email && <span>{codeResult.email}</span>}
                  </div>
                </div>
              )}
              {codeNotFound && (
                <div className="animate-fade-in" style={{ marginTop: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#dc2626', fontWeight: 600 }}>
                  ❌ No user found with code: {codeSearch}
                </div>
              )}
            </div>

            {/* All Users Directory */}
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: '16px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>👥 Staff Directory ({allUsers.length})</h3>
              <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {allUsers.map(u => (
                  <div key={u.pf_no} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#f8fafc', borderRadius: 8 }}>
                    <div style={{ width: 28, height: 28, background: u.role === 'DRM' ? '#1a56db' : u.role === 'SSE' ? '#7c3aed' : u.role === 'IOW' ? '#d97706' : '#10b981', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {u.name[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{u.name}</p>
                      <p style={{ margin: 0, fontSize: 10, color: '#94a3b8' }}>{u.role} · {u.pf_no}</p>
                    </div>
                    {u.unique_code && (
                      <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#1a56db', letterSpacing: 1 }}>{u.unique_code}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* LIVE FEED TAB */}
        {activeTab === 'live' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>🔴 Live Ticket Feed</h3>
                <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Real-time view of all active complaints</p>
              </div>
              <button onClick={fetchAll} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: '#1a56db', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
            {tickets.filter(t => t.status !== 'Closed').sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 20).map(t => (
              <div key={t.id} style={{
                background: 'white', borderRadius: 10, border: '1px solid #e2e8f0',
                borderLeft: `3px solid ${t.flag_color === 'Red' ? '#ef4444' : t.flag_color === 'Orange' ? '#f97316' : t.urgency_escalated ? '#ef4444' : '#1a56db'}`,
                padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                    #{t.id.slice(-6)} · {t.category} — {t.sub_category}
                    {t.urgency_escalated && ' 🆘'}
                    {t.flag_color === 'Red' && ' 🔴'}
                  </p>
                  <p style={{ margin: 0, fontSize: 10, color: '#94a3b8' }}>
                    👤 {t.user?.name || t.pf_no} · {new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>{t.status}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
