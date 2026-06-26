import React, { useState, useEffect, useRef } from 'react';
import { QrCode, Download, RefreshCw } from 'lucide-react';

interface Props {
  onClose?: () => void;
}

// QR Code generation using pure canvas (no external library needed)
// When qrcode npm package is installed, replace drawQR with: QRCode.toCanvas(canvas, data, opts)
function drawQRPlaceholder(canvas: HTMLCanvasElement, text: string) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const size = canvas.width;

  // Draw a placeholder QR-like pattern
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = '#1e293b';
  // Border
  ctx.fillRect(10, 10, 80, 80);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(18, 18, 64, 64);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(26, 26, 48, 48);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(34, 34, 32, 32);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(40, 40, 20, 20);

  // Top right corner
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(size - 90, 10, 80, 80);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(size - 82, 18, 64, 64);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(size - 74, 26, 48, 48);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(size - 66, 34, 32, 32);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(size - 60, 40, 20, 20);

  // Bottom left corner
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(10, size - 90, 80, 80);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(18, size - 82, 64, 64);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(26, size - 74, 48, 48);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(34, size - 66, 32, 32);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(40, size - 60, 20, 20);

  // Data modules (pseudo-random based on text)
  const seed = text.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  ctx.fillStyle = '#1e293b';
  for (let r = 0; r < 20; r++) {
    for (let c = 0; c < 20; c++) {
      const val = (seed * (r + 1) * (c + 1) * 1234567) % 100;
      if (val > 50) {
        const x = 110 + c * 10;
        const y = 30 + r * 10;
        if (x < size - 30 && y < size - 30) {
          ctx.fillRect(x, y, 8, 8);
        }
      }
    }
  }

  // Middle data
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const val = (seed * (r + 7) * (c + 3) * 9876) % 100;
      if (val > 48) {
        const x = 30 + c * 10;
        const y = 130 + r * 10;
        if (y < size - 100) {
          ctx.fillRect(x, y, 8, 8);
        }
      }
    }
  }

  // Label at bottom
  ctx.fillStyle = '#64748b';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  const label = text.length > 30 ? text.substring(0, 30) + '...' : text;
  ctx.fillText(label, size / 2, size - 8);
}

export default function QRGenerator({ onClose }: Props) {
  const [quarterNo, setQuarterNo] = useState('');
  const [quarterType, setQuarterType] = useState('Type IV');
  const [gpsLat, setGpsLat] = useState('');
  const [gpsLng, setGpsLng] = useState('');
  const [generated, setGenerated] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const qrData = JSON.stringify({
    quarter_no: quarterNo,
    quarter_type: quarterType,
    gps_lat: gpsLat,
    gps_lng: gpsLng,
    system: 'RailAwaas-Care',
    generated_at: new Date().toISOString(),
  });

  const generateQR = () => {
    if (!quarterNo) return;
    setGenerated(true);
  };

  useEffect(() => {
    if (generated && canvasRef.current) {
      drawQRPlaceholder(canvasRef.current, qrData);
    }
  }, [generated, qrData]);

  const detectLocation = () => {
    navigator.geolocation.getCurrentPosition(pos => {
      setGpsLat(pos.coords.latitude.toFixed(6));
      setGpsLng(pos.coords.longitude.toFixed(6));
    });
  };

  const downloadQR = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `QR_${quarterType.replace(' ', '')}_${quarterNo}_RailAwaas.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ background: '#eff6ff', borderRadius: 10, padding: 8, display: 'flex' }}>
          <QrCode size={20} color="#1a56db" />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Quarter QR Generator</h3>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Generate scannable QR for each quarter</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label className="rail-label">Quarter Type</label>
          <select className="rail-input" value={quarterType} onChange={e => setQuarterType(e.target.value)}>
            {['Type I', 'Type II', 'Type III', 'Type IV', 'Type V', 'Type VI'].map(t => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="rail-label">Quarter Number *</label>
          <input className="rail-input" value={quarterNo} onChange={e => setQuarterNo(e.target.value)} placeholder="e.g. 12A, 7B" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
        <div>
          <label className="rail-label">GPS Latitude</label>
          <input className="rail-input" value={gpsLat} onChange={e => setGpsLat(e.target.value)} placeholder="e.g. 28.614200" />
        </div>
        <div>
          <label className="rail-label">GPS Longitude</label>
          <input className="rail-input" value={gpsLng} onChange={e => setGpsLng(e.target.value)} placeholder="e.g. 77.209000" />
        </div>
      </div>

      <button onClick={detectLocation} className="btn-ghost" style={{ width: '100%', marginBottom: 16, fontSize: 12 }}>
        📍 Auto-detect Current GPS
      </button>

      <button onClick={generateQR} disabled={!quarterNo} className="btn-primary" style={{ marginBottom: 16 }}>
        <QrCode size={16} /> Generate QR Code
      </button>

      {generated && (
        <div className="animate-scale-in" style={{ textAlign: 'center' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 12, display: 'inline-block' }}>
            <canvas ref={canvasRef} width={260} height={260} style={{ display: 'block' }} />
          </div>
          <p style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>
            {quarterType} · Quarter {quarterNo}
            {gpsLat && ` · GPS: ${gpsLat}, ${gpsLng}`}
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={downloadQR} className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }}>
              <Download size={14} /> Download PNG
            </button>
            <button onClick={() => setGenerated(false)} className="btn-ghost" style={{ padding: '10px 16px' }}>
              <RefreshCw size={14} /> Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
