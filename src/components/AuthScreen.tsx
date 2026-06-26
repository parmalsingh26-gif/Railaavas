import React, { useState } from 'react';
import { loginWithGoogle } from '../firebase';
import { Train, Shield, AlertCircle } from 'lucide-react';

export default function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: any) => void }) {
  const [activeTab, setActiveTab] = useState<'google' | 'hrms'>('google');
  const [pfNumber, setPfNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleSuccess = async (firebaseUser: any) => {
    try {
      const res = await fetch(`/api/profile/${firebaseUser.uid}`);
      if (res.ok) {
        const data = await res.json();
        onAuthenticated(data.user);
      } else {
        onAuthenticated({ isNew: true, firebase_uid: firebaseUser.uid, email: firebaseUser.email });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const user = await loginWithGoogle();
      await handleGoogleSuccess(user);
    } catch (e: any) {
      if (e.code === 'auth/popup-blocked') {
        setErrorMessage("Popup blocked. Please allow popups for this site and try again.");
      } else if (e.code === 'auth/unauthorized-domain') {
        setErrorMessage("Domain not authorized. Add this URL to Firebase Console → Authentication → Authorized domains.");
      } else {
        setErrorMessage(e.message || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (pfNumber.length !== 11) return;
    setLoading(true);
    try {
      await fetch('/api/auth/hrms-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pf_no: pfNumber }),
      });
      setOtpSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-auth-gradient" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, position: 'relative' }}>
      {/* Animated Background Circles */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.06)',
            width: 200 + i * 140, height: 200 + i * 140,
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            animation: `spin-slow ${20 + i * 8}s linear infinite`,
          }} />
        ))}
      </div>

      <div className="animate-fade-in-up" style={{ width: '100%', maxWidth: 420, position: 'relative' }}>
        {/* Logo / Hero */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: 'linear-gradient(135deg, #1a56db, #3730a3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 32px rgba(26,86,219,0.4)',
            border: '2px solid rgba(255,255,255,0.2)',
          }}>
            <Train size={34} color="white" />
          </div>
          <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 900, color: 'white', letterSpacing: '-0.5px' }}>
            RailAwaas Care
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
            Railway Quarter Maintenance System · Indian Railways
          </p>
        </div>

        {/* Card */}
        <div style={{ background: 'rgba(255,255,255,0.97)', borderRadius: 24, overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)' }}>
          {/* Tab Switcher */}
          <div style={{ padding: '20px 20px 0' }}>
            <div className="tab-switcher">
              <button
                className={`tab-btn ${activeTab === 'google' ? 'tab-btn-active' : ''}`}
                onClick={() => { setActiveTab('google'); setErrorMessage(null); }}
              >
                🔐 Google Login
              </button>
              <button
                className={`tab-btn ${activeTab === 'hrms' ? 'tab-btn-active' : ''}`}
                onClick={() => { setActiveTab('hrms'); setErrorMessage(null); }}
              >
                🏛️ HRMS / AIMS
              </button>
            </div>
          </div>

          <div style={{ padding: 24 }}>
            {/* Error Banner */}
            {errorMessage && (
              <div className="animate-fade-in" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <AlertCircle size={15} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ margin: 0, fontSize: 12, color: '#991b1b', lineHeight: 1.5 }}>{errorMessage}</p>
              </div>
            )}

            {/* GOOGLE TAB */}
            {activeTab === 'google' && (
              <div className="animate-fade-in">
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                    {['Employee', 'IOW', 'SSE', 'DRM'].map(role => (
                      <span key={role} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, background: '#f1f5f9', color: '#64748b', fontWeight: 600 }}>
                        {role}
                      </span>
                    ))}
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
                    Sign in with your Google account. Your role will be determined by your registered PF Number.
                  </p>
                </div>

                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                    padding: '13px 20px',
                    background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 14,
                    fontSize: 15, fontWeight: 600, color: '#1e293b', cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)')}
                >
                  {loading ? (
                    <div style={{ width: 20, height: 20, border: '2px solid #e2e8f0', borderTopColor: '#1a56db', borderRadius: '50%', animation: 'spin-slow 0.8s linear infinite' }} />
                  ) : (
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" style={{ width: 22, height: 22 }} />
                  )}
                  {loading ? 'Signing in...' : 'Continue with Google'}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0' }}>
                  <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
                  <Shield size={14} color="#94a3b8" />
                  <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
                </div>
                <p style={{ margin: 0, fontSize: 11, textAlign: 'center', color: '#94a3b8', lineHeight: 1.6 }}>
                  Secured by Firebase Authentication · Data encrypted in transit
                </p>
              </div>
            )}

            {/* HRMS TAB */}
            {activeTab === 'hrms' && (
              <div className="animate-fade-in">
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>🔄</span>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 700, color: '#92400e' }}>Official API Integration</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#b45309' }}>Running in Mock Mode — Real HRMS API coming soon</p>
                  </div>
                  <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 800, color: '#d97706', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 4, padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                    Coming Soon
                  </span>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label className="rail-label">PF Number (11 digits)</label>
                  <input
                    className="rail-input"
                    type="text"
                    value={pfNumber}
                    onChange={e => setPfNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    placeholder="e.g. 12345678901"
                    style={{ fontFamily: 'monospace', fontSize: 16, letterSpacing: 2 }}
                    disabled={otpSent}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: pfNumber.length === 11 ? '#10b981' : '#94a3b8' }}>
                      {pfNumber.length}/11 digits {pfNumber.length === 11 && '✓'}
                    </span>
                  </div>
                </div>

                {otpSent && (
                  <div className="animate-fade-in" style={{ marginBottom: 14 }}>
                    <label className="rail-label">Enter OTP (sent to registered mobile)</label>
                    <input
                      className="rail-input"
                      type="text"
                      value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="• • • • • •"
                      style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 22, letterSpacing: 8 }}
                      maxLength={6}
                    />
                    <p style={{ margin: '6px 0 0', fontSize: 11, color: '#64748b', textAlign: 'center' }}>
                      OTP valid for 10 minutes · <button style={{ background: 'none', border: 'none', color: '#1a56db', cursor: 'pointer', fontSize: 11, fontWeight: 600 }} onClick={() => setOtpSent(false)}>Change PF</button>
                    </p>
                  </div>
                )}

                {!otpSent ? (
                  <button onClick={handleSendOtp} disabled={pfNumber.length !== 11 || loading} className="btn-primary">
                    {loading ? '⏳ Sending...' : '📲 Get OTP on Mobile'}
                  </button>
                ) : (
                  <button disabled={otp.length < 4 || loading} className="btn-primary"
                    onClick={() => alert('Mock: OTP verified! Real integration pending.')}
                  >
                    {loading ? '⏳ Verifying...' : '✅ Verify OTP & Login'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '12px 24px 20px', borderTop: '1px solid #f8fafc', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>
              RailAwaas Care v2.0 · Ministry of Railways, Government of India
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
