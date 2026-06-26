import React, { useState, useEffect } from 'react';
import { Shield, Key, Users, Settings, Save, AlertTriangle } from 'lucide-react';

export default function AdminDashboard({ user }: { user: any }) {
  const [users, setUsers] = useState<any[]>([]);
  const [pins, setPins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [roleForm, setRoleForm] = useState('');
  
  const [pinForm, setPinForm] = useState({ role: 'IOW', pin: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [userRes, pinRes] = await Promise.all([
        fetch('/api/admin/users').then(r => r.json()),
        fetch('/api/admin/pins').then(r => r.json())
      ]);
      setUsers(userRes.users || []);
      setPins(pinRes.pins || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedUser) return;
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.pf_no}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: roleForm }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Role updated successfully');
        setSelectedUser(null);
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSavePin = async () => {
    if (pinForm.pin.length < 4) {
      alert("PIN must be at least 4 characters.");
      return;
    }
    try {
      const res = await fetch('/api/admin/pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pinForm),
      });
      const data = await res.json();
      if (data.success) {
        alert('PIN saved successfully');
        fetchData();
        setPinForm({ ...pinForm, pin: '' });
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield className="text-red-600" /> System Administrator
          </h2>
          <p style={{ margin: '4px 0 0', color: '#64748b' }}>Manage users, roles, and security PINs</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24 }}>
        
        {/* USERS LIST */}
        <div className="card">
          <div style={{ padding: 20, borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} /> <h3 style={{ margin: 0 }}>User Management</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>PF Number</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>Name & Dept</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>Current Role</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.pf_no} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{u.pf_no}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 500 }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{u.department} · {u.designation}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={`status-badge ${u.role === 'Admin' ? 'status-closed' : 'status-inprogress'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button 
                        onClick={() => { setSelectedUser(u); setRoleForm(u.role); }}
                        className="btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }}>
                        Change Role
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SIDEBAR TOOLS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* EDIT ROLE WIDGET */}
          {selectedUser && (
            <div className="card" style={{ padding: 20 }}>
              <h4 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Settings size={16} /> Edit User Role
              </h4>
              <div style={{ marginBottom: 12, fontSize: 13 }}>
                <strong>{selectedUser.name}</strong> ({selectedUser.pf_no})
              </div>
              <select 
                className="rail-input" 
                value={roleForm} 
                onChange={(e) => setRoleForm(e.target.value)}
                style={{ marginBottom: 12 }}
              >
                <option value="Employee">Employee</option>
                <option value="IOW">IOW</option>
                <option value="SSE">SSE</option>
                <option value="ADE">ADE</option>
                <option value="DRM">DRM</option>
                <option value="Admin">Admin</option>
              </select>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-ghost" onClick={() => setSelectedUser(null)} style={{ flex: 1 }}>Cancel</button>
                <button className="btn-primary" onClick={handleUpdateRole} style={{ flex: 1 }}>Save</button>
              </div>
            </div>
          )}

          {/* ROLE PINS WIDGET */}
          <div className="card" style={{ padding: 20 }}>
            <h4 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Key size={16} /> Role Verification PINs
            </h4>
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
              Set PINs that users must enter during profile setup to claim elevated roles automatically.
            </p>
            
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <select 
                className="rail-input" 
                value={pinForm.role} 
                onChange={(e) => setPinForm({ ...pinForm, role: e.target.value })}
                style={{ flex: 1 }}
              >
                <option value="IOW">IOW</option>
                <option value="SSE">SSE</option>
                <option value="ADE">ADE</option>
                <option value="DRM">DRM</option>
              </select>
              <input 
                type="text" 
                className="rail-input" 
                placeholder="Ex: 5566"
                value={pinForm.pin} 
                onChange={(e) => setPinForm({ ...pinForm, pin: e.target.value })}
                style={{ flex: 1 }}
              />
            </div>
            <button className="btn-primary" style={{ width: '100%' }} onClick={handleSavePin}>
              Set PIN
            </button>

            <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pins.map(p => (
                <div key={p.role} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px', background: '#f8fafc', borderRadius: 6 }}>
                  <strong style={{ color: '#0f172a' }}>{p.role}</strong>
                  <span style={{ color: '#059669', fontFamily: 'monospace', fontWeight: 600 }}>{p.pin}</span>
                </div>
              ))}
              {pins.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8' }}>No PINs configured.</div>}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
