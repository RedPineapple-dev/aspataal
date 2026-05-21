import { useState, useEffect } from 'react';
import PatientCard from './PatientCard';
import { apiFetch } from '../api';

function WardOverview({ patients }) {
  const [beds, setBeds] = useState(null);
  const wards = ['ICU', 'General', 'Emergency'];

  useEffect(() => {
    const fetchBeds = async () => {
      try {
        const res = await apiFetch('/api/beds');
        if (res.ok) setBeds(await res.json());
      } catch (err) {
        console.error("Error fetching beds", err);
      }
    };
    fetchBeds();
    const interval = setInterval(fetchBeds, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px' }}>Ward overview</h2>
        <span className="subtle" style={{ fontSize: '12px' }}>{patients.length} patients monitored</span>
      </div>
      {wards.map(ward => {
        const wardPatients = patients.filter(p => p.ward === ward);
        if (wardPatients.length === 0) return null;

        const hasCritical = wardPatients.some(p => p.status === 'CRITICAL');
        const hasWarning = wardPatients.some(p => p.status === 'WARNING');

        let badgeClass = 'badge-green';
        let badgeText = 'All stable';
        let alertCount = wardPatients.reduce((sum, p) => sum + (p.alerts ? p.alerts.length : 0), 0);

        if (hasCritical) { badgeClass = 'badge-red'; badgeText = `${alertCount} active alerts`; }
        else if (hasWarning) { badgeClass = 'badge-yellow'; badgeText = `${alertCount} active alerts`; }

        return (
          <div key={ward} className="ward-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '16px' }}>{ward}</h3>
                <div className="subtle" style={{ fontSize: '12px', marginTop: '2px' }}>
                  {beds && beds[ward]
                    ? `${beds[ward].occupied}/${beds[ward].total} beds occupied`
                    : `${wardPatients.length} patients`}
                </div>
              </div>
              <span className={`badge ${badgeClass}`}>{badgeText}</span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              {wardPatients.map(patient => (
                <PatientCard key={patient.id} patient={patient} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default WardOverview;
