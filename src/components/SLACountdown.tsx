import React, { useState, useEffect, useRef } from 'react';

interface SLACountdownProps {
  deadline: string | Date;
  totalHours?: number; // original SLA hours for % calculation
  compact?: boolean;
}

function getTimeLeft(deadline: Date): { hours: number; minutes: number; seconds: number; isOverdue: boolean; totalSecondsLeft: number } {
  const now = new Date().getTime();
  const end = new Date(deadline).getTime();
  const diff = end - now;

  if (diff <= 0) {
    const overdueSecs = Math.abs(Math.floor(diff / 1000));
    return { hours: Math.floor(overdueSecs / 3600), minutes: Math.floor((overdueSecs % 3600) / 60), seconds: overdueSecs % 60, isOverdue: true, totalSecondsLeft: diff / 1000 };
  }

  const totalSecs = Math.floor(diff / 1000);
  return {
    hours: Math.floor(totalSecs / 3600),
    minutes: Math.floor((totalSecs % 3600) / 60),
    seconds: totalSecs % 60,
    isOverdue: false,
    totalSecondsLeft: totalSecs,
  };
}

export default function SLACountdown({ deadline, totalHours = 48, compact = false }: SLACountdownProps) {
  const [time, setTime] = useState(() => getTimeLeft(new Date(deadline)));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTime(getTimeLeft(new Date(deadline)));
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [deadline]);

  const totalSeconds = totalHours * 3600;
  const pct = time.isOverdue ? 0 : Math.max(0, Math.min(100, (time.totalSecondsLeft / totalSeconds) * 100));

  let colorClass = 'countdown-green';
  let barClass = 'sla-fill-green';
  let bgClass = 'bg-green-50 border-green-200';
  let label = 'On Track';

  if (time.isOverdue) {
    colorClass = 'countdown-overdue';
    bgClass = 'bg-red-50 border-red-300';
    label = 'OVERDUE';
  } else if (pct < 20) {
    colorClass = 'countdown-red';
    barClass = 'sla-fill-red';
    bgClass = 'bg-red-50 border-red-200';
    label = 'Critical';
  } else if (pct < 50) {
    colorClass = 'countdown-yellow';
    barClass = 'sla-fill-yellow';
    bgClass = 'bg-amber-50 border-amber-200';
    label = 'Warning';
  }

  const pad = (n: number) => String(n).padStart(2, '0');

  if (compact) {
    return (
      <span className={colorClass} style={{ fontSize: 13, fontFamily: 'monospace' }}>
        {time.isOverdue
          ? `+${pad(time.hours)}:${pad(time.minutes)}:${pad(time.seconds)} OVERDUE`
          : `${pad(time.hours)}:${pad(time.minutes)}:${pad(time.seconds)}`}
      </span>
    );
  }

  return (
    <div style={{ border: '1px solid', borderRadius: 12, padding: '10px 14px', fontSize: 13 }} className={bgClass}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontWeight: 600, color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          ⏱ SLA Deadline
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: time.isOverdue ? '#fef2f2' : pct < 20 ? '#fef2f2' : pct < 50 ? '#fffbeb' : '#f0fdf4', color: time.isOverdue ? '#dc2626' : pct < 20 ? '#dc2626' : pct < 50 ? '#d97706' : '#16a34a' }}>
          {label}
        </span>
      </div>
      <div className={colorClass} style={{ fontSize: 22, letterSpacing: 2, fontFamily: 'monospace', marginBottom: 6 }}>
        {time.isOverdue
          ? `+${pad(time.hours)}:${pad(time.minutes)}:${pad(time.seconds)}`
          : `${pad(time.hours)}:${pad(time.minutes)}:${pad(time.seconds)}`}
      </div>
      <div className="sla-progress-track">
        <div className={`sla-progress-fill ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
      <div style={{ marginTop: 4, fontSize: 10, color: '#94a3b8' }}>
        {time.isOverdue
          ? `Exceeded SLA by ${pad(time.hours)}h ${pad(time.minutes)}m`
          : `${Math.round(pct)}% time remaining`}
      </div>
    </div>
  );
}
