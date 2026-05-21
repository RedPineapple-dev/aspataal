import { useState, useEffect } from 'react';
import { apiFetch } from '../api';

function AdmissionScreen({ onEnterDashboard }) {
  const [beds, setBeds] = useState(null);
  const [formData, setFormData] = useState({ name: '', age: '', condition: 'Stable', ward: 'ICU' });
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchBeds = async () => {
    try {
      const res = await apiFetch('/api/beds');
      if (res.ok) setBeds(await res.json());
    } catch (err) {
      console.error("Error fetching beds", err);
    }
  };

  useEffect(() => {
    fetchBeds();
    const interval = setInterval(fetchBeds, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch('/api/patients/admit', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setToast(`Patient admitted to ${formData.ward} — Bed ${data.patient.bedId} assigned`);
        setFormData({ name: '', age: '', condition: 'Stable', ward: 'ICU' });
        fetchBeds();
        setTimeout(() => setToast(null), 3000);
      } else {
        alert(data.error || "Failed to admit patient");
      }
    } catch (err) {
      console.error("Error admitting patient", err);
      alert("Network error admitting patient");
    } finally {
      setLoading(false);
    }
  };

  const selectedWardIsFull = beds && beds[formData.ward] && beds[formData.ward].available === 0;

  return (
    <div style={{ minHeight: '100vh', padding: '48px 24px', backgroundColor: 'var(--bg)' }}>
      <div style={{ maxWidth: '820px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div className="brand-wordmark" style={{ fontSize: '32px', justifyContent: 'center' }}>
            <span className="brand-dot" />
            Aspataal
          </div>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '14px' }}>
            Patient admission &amp; ward management
          </p>
        </div>

        {toast && (
          <div style={{
            position: 'fixed', top: '24px', right: '24px',
            backgroundColor: 'var(--surface)', color: 'var(--success)',
            padding: '14px 18px', borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(14,159,110,0.25)',
            boxShadow: 'var(--shadow-md)', zIndex: 1000,
            fontWeight: 500
          }}>
            {toast}
          </div>
        )}

        <div className="surface" style={{ padding: '24px 26px', marginBottom: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <h2 style={{ fontSize: '16px' }}>Ward availability</h2>
            <span className="subtle" style={{ fontSize: '12px' }}>Updated every 3s</span>
          </div>
          {!beds ? <p className="muted">Loading beds…</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {['ICU', 'General', 'Emergency'].map(ward => {
                const data = beds[ward];
                if (!data) return null;
                const isFull = data.available === 0;
                return (
                  <div key={ward} style={{
                    display: 'flex', alignItems: 'center', gap: '16px',
                    padding: '12px 14px',
                    backgroundColor: 'var(--surface-soft)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)'
                  }}>
                    <div style={{ width: '90px', fontWeight: 600, color: 'var(--text)' }}>{ward}</div>
                    <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                      {Array.from({ length: data.total }).map((_, i) => (
                        <div key={i} style={{
                          width: '20px', height: '20px', borderRadius: '4px',
                          backgroundColor: i < data.occupied
                            ? (isFull ? 'var(--critical)' : 'var(--border-strong)')
                            : 'var(--success)',
                          opacity: i < data.occupied ? 1 : 0.85
                        }}></div>
                      ))}
                    </div>
                    <div style={{
                      color: isFull ? 'var(--critical)' : 'var(--success)',
                      fontWeight: 600, fontSize: '13px'
                    }}>
                      {data.occupied}/{data.total} occupied
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="surface" style={{ padding: '24px 26px', marginBottom: '22px' }}>
          <h2 style={{ fontSize: '16px', marginBottom: '18px' }}>Admit new patient</h2>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Name</label>
              <input required type="text" name="name" value={formData.name} onChange={handleInputChange} className="form-input" placeholder="Full name" />
            </div>
            <div>
              <label className="form-label">Age</label>
              <input required type="number" min="1" max="120" name="age" value={formData.age} onChange={handleInputChange} className="form-input" />
            </div>
            <div>
              <label className="form-label">Condition</label>
              <select name="condition" value={formData.condition} onChange={handleInputChange} className="form-select">
                <option value="Stable">Stable</option>
                <option value="Moderate">Moderate</option>
                <option value="Critical">Critical</option>
                <option value="Post-Surgery">Post-Surgery</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Ward</label>
              <select name="ward" value={formData.ward} onChange={handleInputChange} className="form-select">
                <option value="ICU">ICU</option>
                <option value="General">General</option>
                <option value="Emergency">Emergency</option>
              </select>
              {selectedWardIsFull && (
                <div style={{ color: 'var(--critical)', fontSize: '13px', marginTop: '8px' }}>
                  {formData.ward} is full. Please choose another ward.
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={selectedWardIsFull || loading}
              className="btn btn-primary"
              style={{
                gridColumn: '1 / -1',
                marginTop: '6px',
                padding: '12px',
                opacity: selectedWardIsFull || loading ? 0.55 : 1,
                cursor: selectedWardIsFull || loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Admitting…' : 'Admit patient'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center' }}>
          <button onClick={onEnterDashboard} className="btn btn-ghost" style={{ padding: '10px 22px' }}>
            Go to dashboard →
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdmissionScreen;
