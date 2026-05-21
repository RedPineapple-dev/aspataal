import { useState } from 'react';
import VitalCard from './VitalCard';
import HistoricalChart from './HistoricalChart';
import PlaybackModal from './PlaybackModal';
import { apiFetch } from '../api';

function PatientCard({ patient }) {
  const [discharged, setDischarged] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [playbackOpen, setPlaybackOpen] = useState(false);
  const statusColor = patient.status === 'CRITICAL' ? 'red' : patient.status === 'WARNING' ? 'yellow' : 'green';

  const handleDischarge = async (id) => {
    if (window.confirm(`Discharge ${patient.name}? Bed ${patient.bedId} will be freed immediately.`)) {
      try {
        const res = await apiFetch(`/api/patients/${id}/discharge`, { method: 'POST' });
        if (res.ok) {
          setDischarged(true);
          alert(`Patient discharged. Bed ${patient.bedId} is now available.`);
        } else {
          alert('Failed to discharge patient');
        }
      } catch (err) {
        console.error("Error discharging patient", err);
      }
    }
  };

  if (discharged) return null;

  return (
    <div className="patient-card" style={{ flex: '1 1 calc(50% - 16px)', minWidth: '320px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h4 style={{ fontSize: '15px' }}>
            {patient.name}
            <span className="subtle" style={{ fontWeight: 400, marginLeft: '8px', fontSize: '13px' }}>{patient.id}</span>
          </h4>
          <div className="subtle" style={{ fontSize: '12px', marginTop: '4px' }}>
            {patient.ward} · Bed {patient.bedId}
          </div>
        </div>
        <span className={`badge badge-${statusColor}`}>{patient.status}</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <VitalCard name="Heart Rate" value={patient.vitals.heartRate} unit="bpm" normalMin={60} normalMax={100} />
        <VitalCard name="Blood Pressure" value={patient.vitals.bloodPressure} unit="mmHg" normalMin={90} normalMax={120} />
        <VitalCard name="SpO2" value={patient.vitals.spo2} unit="%" normalMin={95} normalMax={100} />
        <VitalCard name="Temperature" value={patient.vitals.temperature} unit="°C" normalMin={36.5} normalMax={37.5} />
      </div>

      <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setShowChart(s => !s)}>
          {showChart ? '▴ Hide trend' : '▾ Show trend (HR + SpO₂)'}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setPlaybackOpen(true)}>
          Review event
        </button>
      </div>

      {showChart && <HistoricalChart patientId={patient.id} />}

      {patient.alerts && patient.alerts.length > 0 && (
        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
          <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Active alerts
          </div>
          <ul style={{ margin: '8px 0 0', paddingLeft: '18px', fontSize: '13px' }}>
            {patient.alerts.map((alert, idx) => (
              <li key={idx} style={{ color: alert.level === 'CRITICAL' ? 'var(--critical)' : 'var(--warning)', marginBottom: '2px' }}>
                {alert.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => handleDischarge(patient.id)} className="btn btn-danger btn-sm">
          Discharge patient
        </button>
      </div>

      {playbackOpen && <PlaybackModal patient={patient} onClose={() => setPlaybackOpen(false)} />}
    </div>
  );
}

export default PatientCard;
