import { useRef } from 'react';

function AlertFeed({ alerts }) {
  const feedRef = useRef(null);

  return (
    <div className="alert-feed" ref={feedRef}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '14px' }}>
        <h2 style={{ fontSize: '16px' }}>Live alert feed</h2>
        <span className="subtle" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {alerts.length} events
        </span>
      </div>

      {alerts.length === 0 ? (
        <p className="muted" style={{ fontSize: '13px' }}>No recent alerts.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {alerts.map((alert, idx) => {
            const isCritical = alert.level === 'CRITICAL';
            return (
              <div key={idx} className={`alert-row ${isCritical ? 'critical' : 'warning'}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span className={`badge ${isCritical ? 'badge-red' : 'badge-yellow'}`}>
                    {alert.level}
                  </span>
                  <span className="subtle mono" style={{ fontSize: '11px' }}>
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <div style={{ marginBottom: '4px', fontSize: '13px' }}>
                  <strong style={{ color: 'var(--text)' }}>{alert.patientId}</strong>
                  <span style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    borderRadius: '999px',
                    marginLeft: '8px'
                  }}>
                    {alert.type}
                  </span>
                </div>

                <div style={{ fontSize: '13px', color: 'var(--text)' }}>
                  {alert.message}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AlertFeed;
