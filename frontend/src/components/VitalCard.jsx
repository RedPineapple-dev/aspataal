import { useEffect, useRef } from 'react';

function VitalCard({ name, value, unit, normalMin, normalMax }) {
  const prevValueRef = useRef(value);

  useEffect(() => {
    prevValueRef.current = value;
  }, [value]);

  const prevValue = prevValueRef.current;

  let color = 'var(--success)';
  if (value < normalMin || value > normalMax) {
    if (name === 'Heart Rate' && (value > 120 || value < 50)) color = 'var(--critical)';
    else if (name === 'SpO2' && value < 90) color = 'var(--critical)';
    else if (name === 'Temperature' && (value > 39 || value < 35)) color = 'var(--critical)';
    else if (name === 'Blood Pressure' && (value > 140 || value < 80)) color = 'var(--critical)';
    else color = 'var(--warning)';
  }

  let trend = '→';
  if (value > prevValue) trend = '↑';
  else if (value < prevValue) trend = '↓';

  return (
    <div className="vital-card">
      <div className="muted" style={{ fontSize: '11px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 }}>
        {name}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
        <span style={{ fontSize: '22px', fontWeight: 700, color, letterSpacing: '-0.01em' }}>{value}</span>
        <span className="subtle" style={{ fontSize: '12px' }}>{unit}</span>
      </div>
      <div style={{ fontSize: '11px', marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
        <span className="subtle">Norm {normalMin}–{normalMax}</span>
        <span style={{ color }}>{trend}</span>
      </div>
    </div>
  );
}

export default VitalCard;
