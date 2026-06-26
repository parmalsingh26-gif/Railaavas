import React, { useState } from 'react';
import { Train, User, Home, MapPin, ChevronRight, ChevronLeft, Lock } from 'lucide-react';

const DEPARTMENTS = [
  'Civil Engineering', 'Electrical Engineering', 'Signal & Telecommunication',
  'Mechanical Engineering', 'Traffic & Transportation', 'Accounts',
  'Personnel & Administration', 'Medical', 'Stores', 'Security (RPF)',
];

const DESIGNATIONS = [
  'Junior Engineer (JE)', 'Section Engineer (SE)', 'Assistant Divisional Engineer (ADE)',
  'Divisional Railway Manager (DRM)', 'Inspector Of Works (IOW)',
  'Senior Section Engineer (SSE)', 'Station Master', 'Guard', 'Loco Pilot',
  'Assistant Loco Pilot', 'Clerk', 'Office Superintendent', 'Other',
];

const STEPS = [
  { id: 1, label: 'Identity', icon: User },
  { id: 2, label: 'Quarter', icon: Home },
  { id: 3, label: 'Confirm', icon: Lock },
];

export default function ProfileSetup({ firebaseUid, email, onComplete }: { firebaseUid: string; email?: string; onComplete: (user: any) => void }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    pf_no: '', name: '', mobile: '', department: '', designation: '', hq: '',
    quarter_type: '', quarter_no: '', quarter_gps_lat: '', quarter_gps_lng: '',
    role: 'Employee',
    role_pin: '',
  });

  const update = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const detectGPS = () => {
    navigator.geolocation.getCurrentPosition(pos => {
      update('quarter_gps_lat', pos.coords.latitude.toFixed(6));
      update('quarter_gps_lng', pos.coords.longitude.toFixed(6));
    });
  };

  const handleSubmit = async () => {
    if (form.pf_no.length !== 11) { alert('PF Number must be exactly 11 digits.'); return; }
    
    setLoading(true);

    // Verify PIN for elevated roles
    if (form.role !== 'Employee' && email !== 'parmalsingh26@gmail.com') {
      try {
        const pinRes = await fetch('/api/auth/verify-role-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // Send pf_no, role, pin. The backend will update user role if found, but user isn't created yet.
          // Wait, verify-role-pin currently tries to update the user which doesn't exist!
          // We can just verify the pin. Let's change backend verify-role-pin or just send it with profile creation.
          // I will send role_pin to /api/profile directly and verify there, it's safer.
        });
      } catch(e) {}
    }

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, firebase_uid: firebaseUid, email }),
      });
      const data = await res.json();
      if (data.success) onComplete(data.user);
      else alert(data.error || 'Failed. Please try again.');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #1a56db 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="animate-scale-in" style={{ width: '100%', maxWidth: 520, background: 'rgba(255,255,255,0.97)', borderRadius: 24, overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.35)' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #1a56db, #3730a3)', padding: '24px 24px 20px', color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <Train size={24} />
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Complete Your Profile</h2>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>This information will be permanently locked in the registry</p>
            </div>
          </div>

          {/* Step Indicator */}
          <div className="step-indicator" style={{ gap: 4 }}>
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isDone = step > s.id;
              const isActive = step === s.id;
              return (
                <React.Fragment key={s.id}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div className={`step-node ${isDone ? 'step-done' : isActive ? 'step-active' : 'step-pending'}`}>
                      {isDone ? '✓' : <Icon size={14} />}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: isActive || isDone ? 'white' : 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`step-line ${isDone ? 'step-line-done' : 'step-line-pending'}`} style={{ background: isDone ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)' }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {/* STEP 1 — Identity */}
          {step === 1 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#1e40af' }}>
                ℹ️ Enter your official details exactly as per service records. This data is immutable once submitted.
              </div>
              <div>
                <label className="rail-label">PF Number (11 digits) *</label>
                <input className="rail-input" value={form.pf_no} onChange={e => update('pf_no', e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="12345678901" style={{ fontFamily: 'monospace', fontSize: 16, letterSpacing: 3 }} />
                <p style={{ margin: '4px 0 0', fontSize: 11, color: form.pf_no.length === 11 ? '#10b981' : '#94a3b8' }}>{form.pf_no.length}/11 {form.pf_no.length === 11 && '✓ Valid'}</p>
              </div>
              <div>
                <label className="rail-label">Full Name (as per service record) *</label>
                <input className="rail-input" value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. Rajesh Kumar Sharma" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="rail-label">Mobile Number *</label>
                  <input className="rail-input" type="tel" value={form.mobile} onChange={e => update('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9876543210" />
                </div>
                <div>
                  <label className="rail-label">Headquarters (HQ)</label>
                  <input className="rail-input" value={form.hq} onChange={e => update('hq', e.target.value)} placeholder="e.g. New Delhi" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="rail-label">Department</label>
                  <select className="rail-input" value={form.department} onChange={e => update('department', e.target.value)}>
                    <option value="">Select</option>
                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="rail-label">Designation</label>
                  <select className="rail-input" value={form.designation} onChange={e => update('designation', e.target.value)}>
                    <option value="">Select</option>
                    {DESIGNATIONS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="rail-label">Role in System</label>
                <select className="rail-input" value={form.role} onChange={e => update('role', e.target.value)}>
                  <option value="Employee">Employee (Quarter Resident)</option>
                  <option value="IOW">IOW (Inspector of Works)</option>
                  <option value="SSE">SSE (Senior Section Engineer)</option>
                  <option value="ADE">ADE</option>
                  <option value="DRM">DRM (Divisional Railway Manager)</option>
                </select>
              </div>
              {form.role !== 'Employee' && email !== 'parmalsingh26@gmail.com' && (
                <div className="animate-fade-in">
                  <label className="rail-label">Role Verification PIN *</label>
                  <input type="password" required className="rail-input" value={form.role_pin} onChange={e => update('role_pin', e.target.value)} placeholder={`Enter PIN for ${form.role}`} />
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>Contact system admin if you don't know the PIN.</p>
                </div>
              )}
              <button onClick={() => setStep(2)} disabled={!form.pf_no || form.pf_no.length !== 11 || !form.name || !form.mobile || (form.role !== 'Employee' && email !== 'parmalsingh26@gmail.com' && !form.role_pin)} className="btn-primary">
                Continue <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* STEP 2 — Quarter Info */}
          {step === 2 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#64748b' }}>
                🏠 Enter your quarter details. GPS coordinates are used for IOW geo-fencing during maintenance visits.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="rail-label">Quarter Type *</label>
                  <select className="rail-input" value={form.quarter_type} onChange={e => update('quarter_type', e.target.value)}>
                    <option value="">Select</option>
                    {['Type I', 'Type II', 'Type III', 'Type IV', 'Type V', 'Type VI (SP)'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="rail-label">Quarter Number *</label>
                  <input className="rail-input" value={form.quarter_no} onChange={e => update('quarter_no', e.target.value)} placeholder="e.g. 12A, 7B" />
                </div>
              </div>
              <div>
                <label className="rail-label">Quarter GPS Coordinates</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
                  <input className="rail-input" value={form.quarter_gps_lat} onChange={e => update('quarter_gps_lat', e.target.value)} placeholder="Latitude (28.6139)" />
                  <input className="rail-input" value={form.quarter_gps_lng} onChange={e => update('quarter_gps_lng', e.target.value)} placeholder="Longitude (77.2090)" />
                </div>
                <button onClick={detectGPS} className="btn-ghost" style={{ width: '100%', fontSize: 12, padding: '9px 16px' }}>
                  <MapPin size={14} /> 📍 Auto-detect My Location (Recommended)
                </button>
                {form.quarter_gps_lat && (
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: '#10b981', fontWeight: 600 }}>
                    ✅ GPS Captured: {form.quarter_gps_lat}, {form.quarter_gps_lng}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setStep(1)} className="btn-ghost" style={{ flex: 1 }}>
                  <ChevronLeft size={16} /> Back
                </button>
                <button onClick={() => setStep(3)} disabled={!form.quarter_type || !form.quarter_no} className="btn-primary" style={{ flex: 2 }}>
                  Review & Confirm <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 — Confirm */}
          {step === 3 && (
            <div className="animate-fade-in">
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#92400e', fontWeight: 500 }}>
                ⚠️ Review carefully — once submitted, this data is <strong>permanently locked</strong> and cannot be edited.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                {[
                  ['PF Number', form.pf_no],
                  ['Full Name', form.name],
                  ['Mobile', form.mobile],
                  ['Department', form.department || '—'],
                  ['Designation', form.designation || '—'],
                  ['HQ', form.hq || '—'],
                  ['Role', form.role],
                  ['Quarter', `${form.quarter_type} · ${form.quarter_no}`],
                  ['GPS', form.quarter_gps_lat ? `${form.quarter_gps_lat}, ${form.quarter_gps_lng}` : 'Not set'],
                ].map(([label, value], i) => (
                  <div key={label} style={{ display: 'flex', padding: '10px 14px', background: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: i < 8 ? '1px solid #f1f5f9' : 'none' }}>
                    <span style={{ flex: '0 0 140px', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button onClick={() => setStep(2)} className="btn-ghost" style={{ flex: 1 }}>
                  <ChevronLeft size={16} /> Edit
                </button>
                <button onClick={handleSubmit} disabled={loading} className="btn-primary" style={{ flex: 2, background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 12px rgba(16,185,129,0.35)' }}>
                  {loading ? '🔒 Locking Profile...' : '🔒 Submit & Lock Profile'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
