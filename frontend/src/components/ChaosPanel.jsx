import { useState, useEffect } from 'react';
import { apiFetch } from '../api';

const wardOptions = ['ICU', 'General', 'Emergency'];

function ChaosPanel() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);

  const fetchStatus = async () => {
    try {
      const res = await apiFetch('/api/admin/chaos/status');
      if (res.ok) setStatus(await res.json());
    } catch (err) {
      console.error('Error fetching chaos status', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    const i = setInterval(fetchStatus, 2000);
    return () => clearInterval(i);
  }, []);

  const trigger = async (payload, label) => {
    setBusy(true);
    try {
      const res = await apiFetch('/api/admin/chaos', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      const ok = res.ok && data.success;
      setLog(prev => [
        { ts: new Date().toLocaleTimeString(), label, ok, payload },
        ...prev
      ].slice(0, 20));
      await fetchStatus();
    } catch (err) {
      console.error('Chaos trigger failed', err);
      setLog(prev => [
        { ts: new Date().toLocaleTimeString(), label, ok: false, payload, error: String(err) },
        ...prev
      ].slice(0, 20));
    } finally {
      setBusy(false);
    }
  };

  const sectionStyle = {
    backgroundColor: 'var(--surface)',
    padding: '20px 22px',
    borderRadius: 'var(--radius)',
    marginBottom: '18px',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-sm)'
  };

  const triggerBtn = (variant = 'default') => {
    const base = {
      padding: '8px 14px',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border-strong)',
      cursor: busy ? 'wait' : 'pointer',
      fontWeight: 600,
      fontSize: '13px',
      opacity: busy ? 0.55 : 1,
      marginRight: '8px',
      marginBottom: '8px',
      backgroundColor: 'var(--surface)',
      color: 'var(--text)'
    };
    if (variant === 'danger') return { ...base, backgroundColor: 'var(--critical-soft)', color: 'var(--critical)', borderColor: 'rgba(220,38,38,0.25)' };
    if (variant === 'warning') return { ...base, backgroundColor: 'var(--warning-soft)', color: 'var(--warning)', borderColor: 'rgba(217,119,6,0.3)' };
    if (variant === 'primary') return { ...base, backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'rgba(79,70,229,0.3)' };
    if (variant === 'success') return { ...base, backgroundColor: 'var(--success-soft)', color: 'var(--success)', borderColor: 'rgba(14,159,110,0.3)' };
    return base;
  };

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', color: 'var(--critical)' }}>Chaos console — resilience testing</h2>
        <p className="muted" style={{ maxWidth: '720px', marginTop: '6px' }}>
          Trigger simulated mass-casualty events and infrastructure failures. Watch the Kubernetes HPA spin up
          new backend pods as data throughput surges. Hit reset to return to normal operation.
        </p>
      </div>

      <div style={sectionStyle}>
        <h3 style={{ fontSize: '15px', marginBottom: '12px' }}>Current state</h3>
        {status ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
            <div><span className="muted">Simulation speed:</span> <strong>{status.speedMultiplier}×</strong> <span className="subtle">({status.tickIntervalMs}ms ticks)</span></div>
            <div><span className="muted">Patients monitored:</span> <strong>{status.patientCount}</strong></div>
            <div>
              <span className="muted">Power failures:</span>{' '}
              {status.powerFailures.length === 0
                ? <span style={{ color: 'var(--success)' }}>none</span>
                : status.powerFailures.map(p => <span key={p.ward} style={{ color: 'var(--critical)', marginRight: '8px' }}>{p.ward} ({p.remainingSec}s)</span>)
              }
            </div>
            <div>
              <span className="muted">Vital surges:</span>{' '}
              {status.surges.length === 0
                ? <span style={{ color: 'var(--success)' }}>none</span>
                : status.surges.map(s => <span key={s.ward} style={{ color: 'var(--warning)', marginRight: '8px' }}>{s.ward} ({s.remainingSec}s)</span>)
              }
            </div>
          </div>
        ) : <p className="muted">Loading chaos state…</p>}
      </div>

      <div style={sectionStyle}>
        <h3 style={{ fontSize: '15px' }}>1. Simulation speed (data throughput stress)</h3>
        <p className="muted" style={{ fontSize: '13px', marginTop: '4px', marginBottom: '12px' }}>
          Multiplies the tick rate, increasing CPU + memory on backend pods so the HPA scales out.
        </p>
        <button disabled={busy} style={triggerBtn('warning')} onClick={() => trigger({ type: 'speed', multiplier: 5 }, '5× speed')}>5× speed</button>
        <button disabled={busy} style={triggerBtn('danger')} onClick={() => trigger({ type: 'speed', multiplier: 10 }, '10× speed')}>10× speed</button>
        <button disabled={busy} style={triggerBtn('danger')} onClick={() => trigger({ type: 'speed', multiplier: 20 }, '20× speed')}>20× speed (extreme)</button>
        <button disabled={busy} style={triggerBtn('primary')} onClick={() => trigger({ type: 'speed', multiplier: 1 }, 'normal speed')}>Normal (1×)</button>
      </div>

      <div style={sectionStyle}>
        <h3 style={{ fontSize: '15px' }}>2. Ward power failure</h3>
        <p className="muted" style={{ fontSize: '13px', marginTop: '4px', marginBottom: '12px' }}>
          Knocks out monitors in a ward for 30 seconds — vitals flatline, tripping critical alerts.
        </p>
        {wardOptions.map(w => (
          <button key={w} disabled={busy} style={triggerBtn('danger')} onClick={() => trigger({ type: 'power_failure', ward: w, durationSec: 30 }, `${w} power failure`)}>
            Simulate {w} power failure
          </button>
        ))}
      </div>

      <div style={sectionStyle}>
        <h3 style={{ fontSize: '15px' }}>3. Mass admission event</h3>
        <p className="muted" style={{ fontSize: '13px', marginTop: '4px', marginBottom: '12px' }}>
          Admits a burst of critically-ill patients to a ward at once. Combined with 10× speed this is the
          canonical load test — the HPA should spin up new backend pods within ~30s.
        </p>
        <button disabled={busy} style={triggerBtn('danger')} onClick={() => trigger({ type: 'mass_admission', ward: 'Emergency', count: 50 }, '50 ER admissions')}>
          Simulate 50 sudden ER admissions
        </button>
        <button disabled={busy} style={triggerBtn('danger')} onClick={() => trigger({ type: 'mass_admission', ward: 'ICU', count: 20 }, '20 ICU admissions')}>
          Simulate 20 ICU admissions
        </button>
      </div>

      <div style={sectionStyle}>
        <h3 style={{ fontSize: '15px' }}>4. Vital surge (existing patients)</h3>
        <p className="muted" style={{ fontSize: '13px', marginTop: '4px', marginBottom: '12px' }}>
          Pushes vitals of existing patients in a ward toward critical thresholds.
        </p>
        {wardOptions.map(w => (
          <button key={w} disabled={busy} style={triggerBtn('warning')} onClick={() => trigger({ type: 'surge', ward: w, durationSec: 60 }, `${w} surge`)}>
            Vital surge · {w}
          </button>
        ))}
      </div>

      <div style={sectionStyle}>
        <h3 style={{ fontSize: '15px' }}>Reset</h3>
        <button disabled={busy} style={triggerBtn('success')} onClick={() => trigger({ type: 'reset' }, 'reset all chaos')}>
          Reset all chaos
        </button>
      </div>

      <div style={sectionStyle}>
        <h3 style={{ fontSize: '15px' }}>Recent triggers</h3>
        {log.length === 0
          ? <p className="muted" style={{ fontSize: '13px', marginTop: '8px' }}>No chaos triggered yet.</p>
          : (
            <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
              {log.map((entry, idx) => (
                <li key={idx} className="mono" style={{
                  padding: '8px 0',
                  borderBottom: '1px solid var(--border)',
                  color: entry.ok ? 'var(--text)' : 'var(--critical)',
                  fontSize: '12px'
                }}>
                  <span className="subtle">{entry.ts}</span> — {entry.ok ? '✓' : '✗'} {entry.label}
                </li>
              ))}
            </ul>
          )
        }
      </div>
    </div>
  );
}

export default ChaosPanel;
