import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import AuthScreen from './components/AuthScreen';
import ProfileSetup from './components/ProfileSetup';
import EmployeeDashboard from './components/EmployeeDashboard';
import IOWDashboard from './components/IOWDashboard';
import DRMDashboard from './components/DRMDashboard';
import SSEDashboard from './components/SSEDashboard';

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #1a56db 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
    }}>
      {/* Animated Train Logo */}
      <div style={{ position: 'relative' }}>
        <div style={{
          width: 80, height: 80, borderRadius: 22,
          background: 'linear-gradient(135deg, #1a56db, #3730a3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(26,86,219,0.5), 0 0 0 1px rgba(255,255,255,0.1)',
          fontSize: 38,
          animation: 'bounce-soft 2s ease-in-out infinite',
        }}>
          🚂
        </div>
        {/* Spinning ring */}
        <div style={{
          position: 'absolute', inset: -8,
          border: '3px solid transparent',
          borderTopColor: 'rgba(26,86,219,0.5)',
          borderRadius: '50%',
          animation: 'spin-slow 1.2s linear infinite',
        }} />
      </div>

      <div style={{ textAlign: 'center' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 900, color: 'white', letterSpacing: '-0.5px' }}>
          RailAwaas Care
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
          Railway Quarter Maintenance System
        </p>
      </div>

      {/* Loading dots */}
      <div style={{ display: 'flex', gap: 6 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.5)',
            animation: `bounce-soft 1s ease-in-out ${i * 0.15}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const res = await fetch(`/api/profile/${firebaseUser.uid}`);
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
          } else {
            setUser({ isNew: true, firebase_uid: firebaseUser.uid });
          }
        } catch (e) {
          console.error('Profile fetch failed:', e);
          setUser({ isNew: true, firebase_uid: firebaseUser.uid });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <LoadingScreen />;
  if (!user)   return <AuthScreen onAuthenticated={setUser} />;
  if (user.isNew) return <ProfileSetup firebaseUid={user.firebase_uid} onComplete={setUser} />;

  const handleLogout = () => setUser(null);

  switch (user.role) {
    case 'Employee': return <EmployeeDashboard user={user} onLogout={handleLogout} />;
    case 'IOW':      return <IOWDashboard      user={user} onLogout={handleLogout} />;
    case 'SSE':      return <SSEDashboard      user={user} onLogout={handleLogout} />;
    case 'DRM':      return <DRMDashboard      user={user} onLogout={handleLogout} />;
    default:         return <EmployeeDashboard user={user} onLogout={handleLogout} />;
  }
}
