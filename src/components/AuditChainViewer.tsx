import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, Clock, MapPin, ChevronDown, ChevronUp } from 'lucide-react';

interface AuditEntry {
  id: number;
  action: string;
  performed_by: string;
  timestamp: string;
  gps_location?: string;
  previous_hash: string;
  current_hash: string;
}

interface Props {
  ticketId: number;
  onClose?: () => void;
}

const ACTION_ICONS: Record<string, string> = {
  'Ticket Submitted':     '📝',
  'Ticket Seen':          '👁️',
  'Work Started':         '🔧',
  'Marked Pending':       '⏳',
  'Assigned':             '👤',
  'Ticket Resolved':      '✅',
  'Ticket Closed':        '🏁',
  'SLA Escalation':       '🚨',
  'SLA Extended':         '⏱️',
  'Extension Requested':  '🙏',
};

function getActionIcon(action: string): string {
  for (const [key, icon] of Object.entries(ACTION_ICONS)) {
    if (action.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return '🔗';
}

function truncateHash(hash: string): string {
  if (!hash || hash === 'GENESIS_BLOCK_0000000000000000') return 'GENESIS';
  return hash.substring(0, 8) + '...' + hash.substring(hash.length - 6);
}

export default function AuditChainViewer({ ticketId, onClose }: Props) {
  const [ledger, setLedger] = useState<AuditEntry[]>([]);
  const [tampered, setTampered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    const fetchAudit = async () => {
      try {
        const res = await fetch(`/api/audit/${ticketId}`);
        const data = await res.json();
        if (data.success) {
          setLedger(data.ledger);
          setTampered(data.tampered);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchAudit();
  }, [ticketId]);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#1a56db', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin-slow 1s linear infinite' }} />
        <p style={{ color: '#64748b', fontSize: 13 }}>Loading blockchain audit...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: tampered ? '#fef2f2' : '#f0fdf4', borderRadius: 10, padding: 8, display: 'flex' }}>
            <Shield size={20} color={tampered ? '#dc2626' : '#10b981'} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Blockchain Audit Chain</h3>
            <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>Ticket #{ticketId} · {ledger.length} entries</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: '#64748b' }}>
            Close
          </button>
        )}
      </div>

      {/* Integrity Banner */}
      <div style={{
        padding: '10px 14px',
        borderRadius: 10,
        marginBottom: 16,
        background: tampered ? '#fef2f2' : '#f0fdf4',
        border: `1px solid ${tampered ? '#fecaca' : '#a7f3d0'}`,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        {tampered
          ? <><AlertTriangle size={16} color="#dc2626" /> <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>⚠️ TAMPER DETECTED — Hash chain integrity compromised!</span></>
          : <><CheckCircle size={16} color="#10b981" /> <span style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>✅ Hash chain verified — All records intact & untampered</span></>
        }
      </div>

      {/* Chain Entries */}
      <div>
        {ledger.map((entry, index) => {
          const isExpanded = expandedId === entry.id;
          const isTamperedEntry = index > 0 && entry.previous_hash !== ledger[index - 1].current_hash;

          return (
            <div key={entry.id} className="chain-item" style={{ marginBottom: 8 }}>
              <div className={`chain-dot ${isTamperedEntry ? 'chain-dot-tamper' : ''}`}>
                <span style={{ fontSize: 8 }}>#{index + 1}</span>
              </div>

              <div
                style={{
                  background: isTamperedEntry ? '#fef2f2' : '#f8fafc',
                  border: `1px solid ${isTamperedEntry ? '#fecaca' : '#e2e8f0'}`,
                  borderRadius: 10,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  marginBottom: 2,
                }}
                onClick={() => setExpandedId(isExpanded ? null : entry.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 14 }}>{getActionIcon(entry.action)}</span>
                      <span style={{ fontWeight: 600, fontSize: 13, color: isTamperedEntry ? '#dc2626' : '#1e293b' }}>
                        {entry.action}
                      </span>
                      {isTamperedEntry && <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, padding: '1px 5px' }}>TAMPERED</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={10} /> {new Date(entry.timestamp).toLocaleString()}
                      </span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>
                        By: <strong>{entry.performed_by}</strong>
                      </span>
                      {entry.gps_location && (
                        <span style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <MapPin size={10} /> {entry.gps_location}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ color: '#94a3b8', marginLeft: 8 }}>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="animate-fade-in" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #e2e8f0' }}>
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Previous Hash</span>
                      <div className="chain-hash" style={{ marginTop: 3 }}>{entry.previous_hash}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Current Hash (SHA-256)</span>
                      <div className="chain-hash" style={{ marginTop: 3, borderColor: '#c7d2fe', background: '#eef2ff', color: '#3730a3' }}>{entry.current_hash}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
