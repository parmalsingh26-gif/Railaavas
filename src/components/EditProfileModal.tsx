import React, { useState } from 'react';
import { X, Save, Copy, Check, Edit2, AlertCircle } from 'lucide-react';

export default function EditProfileModal({ user, onClose, onUpdate }: { user: any; onClose: () => void; onUpdate: (user: any) => void }) {
  const [form, setForm] = useState({
    mobile: user.mobile || '',
    department: user.department || '',
    designation: user.designation || '',
    hq: user.hq || '',
    quarter_type: user.quarter_type || '',
    quarter_no: user.quarter_no || '',
    quarter_gps_lat: user.quarter_gps_lat || '',
    quarter_gps_lng: user.quarter_gps_lng || '',
  });
  const [loading, setLoading] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showNameRequest, setShowNameRequest] = useState(false);
  const [nameRequestForm, setNameRequestForm] = useState({ new_name: '', reason: '' });
  const [nameRequestLoading, setNameRequestLoading] = useState(false);
  const [nameRequestSent, setNameRequestSent] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const update = (k: string, v: string) => setForm({ ...form, [k]: v });

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/profile/${user.firebase_uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) { onUpdate(data.user); onClose(); }
      else alert(data.error || 'Failed to update profile');
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const copyCode = () => {
    if (user.unique_code) {
      navigator.clipboard.writeText(user.unique_code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const detectGPS = () => {
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setForm(f => ({ ...f, quarter_gps_lat: pos.coords.latitude.toFixed(6), quarter_gps_lng: pos.coords.longitude.toFixed(6) }));
        setGpsLoading(false);
      },
      () => { alert('GPS unavailable'); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const submitNameRequest = async () => {
    if (!nameRequestForm.new_name.trim() || !nameRequestForm.reason.trim()) return;
    setNameRequestLoading(true);
    try {
      const res = await fetch('/api/profile/name-change-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pf_no: user.pf_no, ...nameRequestForm }),
      });
      const data = await res.json();
      if (data.success) { setNameRequestSent(true); setShowNameRequest(false); }
      else alert(data.error || 'Request failed');
    } catch (e) { console.error(e); }
    finally { setNameRequestLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 520 }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #1a56db, #3730a3)', padding: '20px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Edit Profile</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, opacity: 0.8 }}>Update your contact and quarter information</p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'white' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Unique Code Card */}
          {user.unique_code && (
            <div className="unique-code-card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                    🔑 Your RailAwaas Identity Code
                  </p>
                  <div className="unique-code-value">{user.unique_code}</div>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                    Share this code with SSE/DRM for identification
                  </p>
                </div>
                <button onClick={copyCode} style={{
                  background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                  borderRadius: 10, padding: '8px 12px', cursor: 'pointer', color: 'white',
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
                }}>
                  {codeCopied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
                </button>
              </div>
            </div>
          )}

          {/* Identity Info (Name + PF - request change) */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Identity Details</p>
              {!nameRequestSent && (
                <button onClick={() => setShowNameRequest(v => !v)} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 11, color: '#1a56db', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                  <Edit2 size={11} /> Request Name Change
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <p style={{ margin: '0 0 2px', fontSize: 11, color: '#94a3b8' }}>Name</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{user.name}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 2px', fontSize: 11, color: '#94a3b8' }}>PF Number</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b', fontFamily: 'monospace' }}>{user.pf_no}</p>
              </div>
              {user.email && (
                <div style={{ gridColumn: '1/-1' }}>
                  <p style={{ margin: '0 0 2px', fontSize: 11, color: '#94a3b8' }}>Email</p>
                  <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>{user.email}</p>
                </div>
              )}
            </div>

            {nameRequestSent && (
              <div style={{ marginTop: 10, background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#059669', fontWeight: 600 }}>
                ✅ Name change request submitted. SSE will review it.
              </div>
            )}

            {showNameRequest && !nameRequestSent && (
              <div className="animate-fade-in" style={{ marginTop: 12, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#1d4ed8' }}>📝 Name Change Request</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <label className="rail-label" style={{ fontSize: 11 }}>New Name *</label>
                    <input className="rail-input" style={{ fontSize: 13, padding: '8px 12px' }} value={nameRequestForm.new_name} onChange={e => setNameRequestForm(f => ({ ...f, new_name: e.target.value }))} placeholder="Enter correct name" />
                  </div>
                  <div>
                    <label className="rail-label" style={{ fontSize: 11 }}>Reason *</label>
                    <input className="rail-input" style={{ fontSize: 13, padding: '8px 12px' }} value={nameRequestForm.reason} onChange={e => setNameRequestForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Spelling error, name change" />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setShowNameRequest(false)} className="btn-ghost" style={{ flex: 1, padding: '8px 0', fontSize: 12 }}>Cancel</button>
                    <button onClick={submitNameRequest} disabled={nameRequestLoading || !nameRequestForm.new_name.trim() || !nameRequestForm.reason.trim()} className="btn-primary" style={{ flex: 2, padding: '8px 0', fontSize: 12 }}>
                      {nameRequestLoading ? 'Submitting...' : 'Submit Request'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Editable Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label className="rail-label">Mobile Number</label>
              <input className="rail-input" value={form.mobile} onChange={e => update('mobile', e.target.value)} placeholder="10-digit mobile" />
            </div>
            <div>
              <label className="rail-label">Headquarters</label>
              <input className="rail-input" value={form.hq} onChange={e => update('hq', e.target.value)} placeholder="e.g. New Delhi" />
            </div>
            <div>
              <label className="rail-label">Department</label>
              <input className="rail-input" value={form.department} onChange={e => update('department', e.target.value)} placeholder="e.g. Civil" />
            </div>
            <div>
              <label className="rail-label">Designation</label>
              <input className="rail-input" value={form.designation} onChange={e => update('designation', e.target.value)} placeholder="e.g. JE" />
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '16px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: 14, color: '#1e293b', fontWeight: 700 }}>🏠 Quarter Details</h4>
            <button onClick={detectGPS} disabled={gpsLoading} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 11, color: '#1a56db', fontWeight: 600 }}>
              {gpsLoading ? '📡 Detecting...' : '📍 Auto-detect GPS'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label className="rail-label">Quarter Type</label>
              <select className="rail-input" value={form.quarter_type} onChange={e => update('quarter_type', e.target.value)}>
                <option value="">Select Type</option>
                {['Type I', 'Type II', 'Type III', 'Type IV', 'Type V', 'Type VI (SP)'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="rail-label">Quarter Number</label>
              <input className="rail-input" value={form.quarter_no} onChange={e => update('quarter_no', e.target.value)} placeholder="e.g. A-12" />
            </div>
            <div>
              <label className="rail-label">GPS Latitude</label>
              <input className="rail-input" value={form.quarter_gps_lat} onChange={e => update('quarter_gps_lat', e.target.value)} placeholder="28.6139" />
            </div>
            <div>
              <label className="rail-label">GPS Longitude</label>
              <input className="rail-input" value={form.quarter_gps_lng} onChange={e => update('quarter_gps_lng', e.target.value)} placeholder="77.2090" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={onClose} className="btn-ghost" style={{ flex: 1 }}>Cancel</button>
            <button onClick={handleSave} disabled={loading} className="btn-primary" style={{ flex: 2 }}>
              {loading ? 'Saving...' : <><Save size={16} /> Save Changes</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
