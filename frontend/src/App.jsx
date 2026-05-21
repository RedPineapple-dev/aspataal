import { useState, useEffect } from 'react';
import WardOverview from './components/WardOverview';
import AlertFeed from './components/AlertFeed';
import AdmissionScreen from './components/AdmissionScreen';
import ChaosPanel from './components/ChaosPanel';
import { apiFetch, isAuditMode, setAuditMode, onAuditModeChange } from './api';

function App() {
  const [patients, setPatients] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [screen, setScreen] = useState('admission'); // 'admission' | 'dashboard' | 'chaos'
  const [auditMode, setAuditModeState] = useState(isAuditMode());

  useEffect(() => {
    const unsub = onAuditModeChange(setAuditModeState);
    return unsub;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const [patientsRes, alertsRes] = await Promise.all([
          apiFetch('/api/patients'),
          apiFetch('/api/alerts/history')
        ]);
        if (cancelled) return;
        if (patientsRes.ok) setPatients(await patientsRes.json());
        if (alertsRes.ok) setAlerts(await alertsRes.json());
      } catch (err) {
        console.error("Error fetching data", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [auditMode]);

  if (screen === 'admission') {
    return <AdmissionScreen onEnterDashboard={() => setScreen('dashboard')} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--bg)' }}>
      <header style={{
        padding: '14px 28px',
        backgroundColor: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <span className="brand-wordmark">
            <span className="brand-dot" />
            Aspataal
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-subtle)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            <span className="pulse-dot" />
            Live monitoring
          </span>
          {auditMode && (
            <span className="badge badge-indigo">Audit mode · PII hashed</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={auditMode}
              onChange={(e) => setAuditMode(e.target.checked)}
              style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
            />
            Audit mode
          </label>
          <button
            className={`btn ${screen === 'chaos' ? 'btn-danger' : 'btn-ghost'}`}
            onClick={() => setScreen(screen === 'chaos' ? 'dashboard' : 'chaos')}
          >
            {screen === 'chaos' ? '← Dashboard' : 'Chaos Console'}
          </button>
          <button className="btn btn-primary" onClick={() => setScreen('admission')}>
            + Admit patient
          </button>
        </div>
      </header>

      <main style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div className="scroll-y" style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
          {screen === 'chaos'
            ? <ChaosPanel />
            : <WardOverview patients={patients} />}
        </div>

        <aside style={{ width: '380px', borderLeft: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
          <AlertFeed alerts={alerts} />
        </aside>
      </main>
    </div>
  );
}
export default App;
