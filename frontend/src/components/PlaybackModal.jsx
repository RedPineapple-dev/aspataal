import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api';
import VitalCard from './VitalCard';

function PlaybackModal({ patient, onClose }) {
  const [snapshots, setSnapshots] = useState([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await apiFetch(`/api/patients/${patient.id}/playback?windowSec=300`);
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json();
            setSnapshots(data.snapshots || []);
            setIdx(0);
          } else {
            setError(`Playback API returned ${res.status}`);
          }
        }
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [patient.id]);

  useEffect(() => {
    if (!playing || snapshots.length === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const interval = Math.max(80, 1000 / playbackRate);
    timerRef.current = setInterval(() => {
      setIdx(prev => {
        if (prev >= snapshots.length - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, interval);
    return () => clearInterval(timerRef.current);
  }, [playing, playbackRate, snapshots.length]);

  const current = snapshots[idx];
  const overlay = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 2000,
    backdropFilter: 'blur(2px)'
  };
  const modal = {
    backgroundColor: 'var(--surface)',
    borderRadius: 'var(--radius)',
    padding: '24px 26px',
    maxWidth: '740px',
    width: '92%',
    maxHeight: '90vh',
    overflowY: 'auto',
    border: '1px solid var(--border)',
    boxShadow: '0 24px 48px rgba(15,23,42,0.18)'
  };

  const ctrlBtn = (variant = 'default') => {
    const base = {
      padding: '7px 12px',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border-strong)',
      backgroundColor: 'var(--surface)',
      color: 'var(--text)',
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: '13px',
      marginRight: '6px'
    };
    if (variant === 'play') return { ...base, backgroundColor: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' };
    if (variant === 'pause') return { ...base, backgroundColor: 'var(--critical-soft)', color: 'var(--critical)', borderColor: 'rgba(220,38,38,0.25)' };
    return base;
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
          <div>
            <h2 style={{ fontSize: '17px' }}>Black box playback</h2>
            <div className="subtle" style={{ fontSize: '13px', marginTop: '4px' }}>
              {patient.name} · {patient.id} · {patient.ward} / {patient.bedId}
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Close</button>
        </div>

        {loading && <p className="muted">Loading buffered snapshots…</p>}
        {error && <p style={{ color: 'var(--critical)' }}>Error: {error}</p>}

        {!loading && !error && snapshots.length === 0 && (
          <p className="muted">No snapshots buffered yet — wait a few seconds for the simulator to populate the black box.</p>
        )}

        {current && (
          <>
            <div style={{
              padding: '14px 16px',
              backgroundColor: 'var(--surface-soft)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div className="mono muted" style={{ fontSize: '12px' }}>
                  T-{snapshots.length - 1 - idx} ticks · {new Date(current.timestamp).toLocaleString()}
                </div>
                <span className={`badge badge-${current.status === 'CRITICAL' ? 'red' : current.status === 'WARNING' ? 'yellow' : 'green'}`}>
                  {current.status}
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <VitalCard name="Heart Rate" value={current.vitals.heartRate} unit="bpm" normalMin={60} normalMax={100} />
                <VitalCard name="Blood Pressure" value={current.vitals.bloodPressure} unit="mmHg" normalMin={90} normalMax={120} />
                <VitalCard name="SpO2" value={current.vitals.spo2} unit="%" normalMin={95} normalMax={100} />
                <VitalCard name="Temperature" value={current.vitals.temperature} unit="°C" normalMin={36.5} normalMax={37.5} />
              </div>

              {current.alerts && current.alerts.length > 0 && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                  <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                    Alerts at this moment
                  </div>
                  <ul style={{ margin: '6px 0 0', paddingLeft: '20px', fontSize: '13px' }}>
                    {current.alerts.map((a, i) => (
                      <li key={i} style={{ color: a.level === 'CRITICAL' ? 'var(--critical)' : 'var(--warning)' }}>
                        {a.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <input
              type="range"
              min={0}
              max={snapshots.length - 1}
              value={idx}
              onChange={(e) => { setIdx(parseInt(e.target.value)); setPlaying(false); }}
              style={{ width: '100%', marginBottom: '14px', accentColor: 'var(--accent)' }}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <button style={ctrlBtn(playing ? 'pause' : 'play')} onClick={() => setPlaying(p => !p)}>
                  {playing ? '❚❚ Pause' : '▶ Play'}
                </button>
                <button style={ctrlBtn()} onClick={() => { setIdx(0); setPlaying(false); }}>⏮ Start</button>
                <button style={ctrlBtn()} onClick={() => setIdx(i => Math.max(0, i - 1))}>← Step</button>
                <button style={ctrlBtn()} onClick={() => setIdx(i => Math.min(snapshots.length - 1, i + 1))}>Step →</button>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
                Speed
                {[1, 2, 4, 8].map(rate => (
                  <button
                    key={rate}
                    onClick={() => setPlaybackRate(rate)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-xs)',
                      border: '1px solid ' + (playbackRate === rate ? 'var(--accent)' : 'var(--border-strong)'),
                      backgroundColor: playbackRate === rate ? 'var(--accent-soft)' : 'var(--surface)',
                      color: playbackRate === rate ? 'var(--accent)' : 'var(--text)',
                      fontWeight: 600,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    {rate}×
                  </button>
                ))}
              </div>
            </div>

            <div className="subtle" style={{ marginTop: '14px', fontSize: '12px', textAlign: 'center' }}>
              Snapshot {idx + 1} / {snapshots.length} buffered from the past 5 minutes
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default PlaybackModal;
