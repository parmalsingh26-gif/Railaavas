import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, CheckCheck } from 'lucide-react';

interface Notification {
  id: number;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

interface Props {
  userPf: string;
}

export default function NotificationBell({ userPf }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`/api/notifications/${userPf}`);
      const data = await res.json();
      if (data.success) setNotifications(data.notifications);
    } catch (e) {}
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [userPf]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const markAllRead = async () => {
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_pf: userPf }),
    });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      <button
        onClick={() => { setOpen(o => !o); if (!open) fetchNotifications(); }}
        style={{
          background: 'rgba(255,255,255,0.15)',
          border: 'none',
          borderRadius: 10,
          padding: '8px',
          cursor: 'pointer',
          color: 'white',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          transition: 'background 0.2s',
        }}
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-panel">
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>
              Notifications {unreadCount > 0 && <span style={{ background: '#ef4444', color: 'white', borderRadius: 999, fontSize: 10, padding: '1px 6px', marginLeft: 4 }}>{unreadCount}</span>}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {unreadCount > 0 && (
                <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1a56db', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={16} />
              </button>
            </div>
          </div>

          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                <Bell size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id} style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #f8fafc',
                  background: n.is_read ? 'transparent' : '#f0f7ff',
                  transition: 'background 0.2s',
                }}>
                  {!n.is_read && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1a56db', float: 'right', marginTop: 4 }} />}
                  <p style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', margin: '0 0 3px' }}>{n.title}</p>
                  <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px', lineHeight: 1.4 }}>{n.body}</p>
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{timeAgo(n.created_at)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
