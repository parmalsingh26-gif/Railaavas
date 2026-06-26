import React, { useState } from 'react';
import { X, CheckCircle, Save } from 'lucide-react';

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
      if (data.success) {
        onUpdate(data.user);
        onClose();
      } else {
        alert(data.error || 'Failed to update profile');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 500 }}>
        <div style={{ background: 'linear-gradient(135deg, #1a56db, #3730a3)', padding: '20px', color: 'white', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Edit Profile Details</h3>
            <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>Update your contact and quarter information</p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'white', height: 32 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
            <p style={{ margin: '0 0 4px', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Locked Details (Cannot be changed)</p>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{user.name}</span>
              <span style={{ fontSize: 13, color: '#64748b', fontFamily: 'monospace' }}>PF: {user.pf_no}</span>
            </div>
            {user.email && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Email: {user.email}</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label className="rail-label">Mobile Number</label>
              <input className="rail-input" value={form.mobile} onChange={e => update('mobile', e.target.value)} />
            </div>
            <div>
              <label className="rail-label">Headquarters</label>
              <input className="rail-input" value={form.hq} onChange={e => update('hq', e.target.value)} />
            </div>
            <div>
              <label className="rail-label">Department</label>
              <input className="rail-input" value={form.department} onChange={e => update('department', e.target.value)} />
            </div>
            <div>
              <label className="rail-label">Designation</label>
              <input className="rail-input" value={form.designation} onChange={e => update('designation', e.target.value)} />
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '16px 0' }} />
          <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#1e293b' }}>Quarter Details</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label className="rail-label">Quarter Type</label>
              <select className="rail-input" value={form.quarter_type} onChange={e => update('quarter_type', e.target.value)}>
                {['Type I', 'Type II', 'Type III', 'Type IV', 'Type V', 'Type VI (SP)'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="rail-label">Quarter Number</label>
              <input className="rail-input" value={form.quarter_no} onChange={e => update('quarter_no', e.target.value)} />
            </div>
            <div>
              <label className="rail-label">GPS Latitude</label>
              <input className="rail-input" value={form.quarter_gps_lat} onChange={e => update('quarter_gps_lat', e.target.value)} />
            </div>
            <div>
              <label className="rail-label">GPS Longitude</label>
              <input className="rail-input" value={form.quarter_gps_lng} onChange={e => update('quarter_gps_lng', e.target.value)} />
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
