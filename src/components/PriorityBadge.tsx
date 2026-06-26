import React from 'react';

interface PriorityBadgeProps {
  priority: string;
  size?: 'sm' | 'md';
}

const ICONS: Record<string, string> = {
  Critical: '🔴',
  High:     '🟠',
  Medium:   '🟡',
  Low:      '🟢',
};

export default function PriorityBadge({ priority, size = 'md' }: PriorityBadgeProps) {
  const classMap: Record<string, string> = {
    Critical: 'badge badge-critical',
    High:     'badge badge-high',
    Medium:   'badge badge-medium',
    Low:      'badge badge-low',
  };

  const cls = classMap[priority] || 'badge badge-low';
  const icon = ICONS[priority] || '⚪';
  const fontSize = size === 'sm' ? 10 : 11;

  return (
    <span className={cls} style={{ fontSize }}>
      {icon} {priority}
    </span>
  );
}
