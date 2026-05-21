import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { apiFetch } from '../api';

function HistoricalChart({ patientId, refreshMs = 5000 }) {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await apiFetch(`/api/patients/${patientId}/history?points=120`);
        if (!cancelled && res.ok) {
          const data = await res.json();
          const formatted = (data.points || []).map(p => ({
            time: new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            heartRate: p.heartRate,
            spo2: p.spo2
          }));
          setPoints(formatted);
        }
      } catch (err) {
        console.error('Error fetching patient history', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [patientId, refreshMs]);

  if (loading && points.length === 0) {
    return <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>Loading history…</div>;
  }

  if (points.length < 2) {
    return <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>Collecting data…</div>;
  }

  return (
    <div style={{ width: '100%', height: '170px', marginTop: '14px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e6e8ec" />
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#98a0ad' }} interval="preserveStartEnd" minTickGap={40} stroke="#d6d9df" />
          <YAxis yAxisId="hr" orientation="left" tick={{ fontSize: 10, fill: '#dc2626' }} domain={['auto', 'auto']} width={32} stroke="#d6d9df" />
          <YAxis yAxisId="spo2" orientation="right" tick={{ fontSize: 10, fill: '#4f46e5' }} domain={[80, 100]} width={32} stroke="#d6d9df" />
          <Tooltip
            contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e6e8ec', borderRadius: '8px', fontSize: '12px', boxShadow: '0 6px 18px rgba(15,23,42,0.08)' }}
            labelStyle={{ color: '#0f172a' }}
          />
          <Legend wrapperStyle={{ fontSize: '11px' }} />
          <Line yAxisId="hr" type="monotone" dataKey="heartRate" stroke="#dc2626" dot={false} strokeWidth={2} name="HR (bpm)" isAnimationActive={false} />
          <Line yAxisId="spo2" type="monotone" dataKey="spo2" stroke="#4f46e5" dot={false} strokeWidth={2} name="SpO2 (%)" isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default HistoricalChart;
