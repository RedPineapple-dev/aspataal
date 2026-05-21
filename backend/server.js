const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const simulationEngine = require('./simulationEngine');
const alertEngine = require('./alertEngine');
const metricsExporter = require('./metricsExporter');

const app = express();
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  metricsExporter.recordApiRequest();
  next();
});

// --- Audit Mode (Zero-Knowledge PII Anonymization) ---------------------------
// When the request opts into audit mode (header X-Audit-Mode: true OR query ?audit=1),
// outgoing JSON payloads are walked recursively and PII fields (name, phone, ssn,
// email) are replaced with deterministic SHA-256 hashes. Age is bucketed for
// k-anonymity. The medical vital streams remain untouched.
function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function anonymize(value) {
  if (Array.isArray(value)) return value.map(anonymize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const keyLower = k.toLowerCase();
      if (v && typeof v === 'string' && (keyLower === 'name' || keyLower === 'patientname')) {
        const hash = sha256(v);
        out[k] = `ANON-${hash.slice(0, 12).toUpperCase()}`;
        out.nameHash = hash;
      } else if (v && typeof v === 'string' && (keyLower === 'phone' || keyLower === 'ssn' || keyLower === 'email')) {
        out[k] = sha256(v).slice(0, 16);
      } else if (keyLower === 'age' && typeof v === 'number') {
        const bucket = Math.floor(v / 10) * 10;
        out[k] = `${bucket}-${bucket + 9}`;
      } else {
        out[k] = anonymize(v);
      }
    }
    return out;
  }
  return value;
}

app.use((req, res, next) => {
  const auditMode =
    req.headers['x-audit-mode'] === 'true' ||
    req.query.audit === '1' ||
    req.query.audit === 'true';
  if (!auditMode) return next();

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    res.set('X-Audit-Mode', 'true');
    return originalJson(anonymize(body));
  };
  next();
});

const wardBeds = {
  ICU: {
    totalBeds: 3,
    beds: [
      { bedId: "ICU-1", status: "occupied", patientId: "P001" },
      { bedId: "ICU-2", status: "occupied", patientId: "P002" },
      { bedId: "ICU-3", status: "available", patientId: null }
    ]
  },
  General: {
    totalBeds: 4,
    beds: [
      { bedId: "GEN-1", status: "occupied", patientId: "P003" },
      { bedId: "GEN-2", status: "occupied", patientId: "P004" },
      { bedId: "GEN-3", status: "available", patientId: null },
      { bedId: "GEN-4", status: "available", patientId: null }
    ]
  },
  Emergency: {
    totalBeds: 3,
    beds: [
      { bedId: "EMR-1", status: "occupied", patientId: "P005" },
      { bedId: "EMR-2", status: "occupied", patientId: "P006" },
      { bedId: "EMR-3", status: "available", patientId: null }
    ]
  }
};

let nextPatientId = 7;
let currentPatientsData = [];

const BASE_TICK_MS = 3000;
let tickHandle = null;
let currentTickMs = BASE_TICK_MS;

function tick() {
  const updated = simulationEngine.updateVitals();
  let allNewAlerts = [];

  currentPatientsData = updated.map(p => {
    const history = simulationEngine.getHistory(p.id);
    const { activeAlerts, overallStatus } = alertEngine.evaluateAlerts(p, p.vitals, history, p.timestamp);
    allNewAlerts = allNewAlerts.concat(activeAlerts);

    const patientRecord = {
      id: p.id,
      name: p.name,
      age: p.age,
      bedId: p.bedId,
      admittedAt: p.admittedAt,
      ward: p.ward,
      vitals: p.vitals,
      alerts: activeAlerts,
      status: overallStatus
    };

    // Record full snapshot into the black-box buffer (used by playback + charts)
    simulationEngine.recordSnapshot(p.id, {
      timestamp: p.timestamp,
      vitals: p.vitals,
      alerts: activeAlerts,
      status: overallStatus
    });

    return patientRecord;
  });

  metricsExporter.updateAlertMetrics(alertEngine.getActiveAlerts(), allNewAlerts);
  metricsExporter.updateSimSpeed(simulationEngine.getSpeedMultiplier());
  metricsExporter.updatePatientsMonitored(currentPatientsData.length);
}

function startTickLoop() {
  if (tickHandle) clearInterval(tickHandle);
  const multiplier = simulationEngine.getSpeedMultiplier();
  currentTickMs = Math.max(150, Math.floor(BASE_TICK_MS / multiplier));
  tickHandle = setInterval(tick, currentTickMs);
}

startTickLoop();

// Kick off an initial tick so the dashboard has data immediately.
setTimeout(tick, 0);


app.get('/api/patients', (req, res) => {
  res.json(currentPatientsData);
});

app.get('/api/beds', (req, res) => {
  const result = {};
  for (const [ward, data] of Object.entries(wardBeds)) {
    const available = data.beds.filter(b => b.status === 'available').length;
    result[ward] = {
      total: data.totalBeds,
      available,
      occupied: data.totalBeds - available,
      beds: data.beds
    };
  }
  res.json(result);
});

app.post('/api/patients/admit', (req, res) => {
  const { name, age, condition, ward } = req.body;
  if (!wardBeds[ward]) {
    return res.status(400).json({ error: "Invalid ward" });
  }

  const availableBed = wardBeds[ward].beds.find(b => b.status === 'available');
  if (!availableBed) {
    return res.status(409).json({ error: `No beds available in ${ward}. Please choose another ward.` });
  }

  const newPatientId = `P${String(nextPatientId++).padStart(3, '0')}`;
  availableBed.status = 'occupied';
  availableBed.patientId = newPatientId;

  const newPatient = {
    id: newPatientId,
    name,
    age: parseInt(age),
    condition,
    ward,
    bedId: availableBed.bedId,
    offset: Math.floor(Math.random() * 20) - 10,
    admittedAt: new Date().toISOString()
  };

  simulationEngine.addPatient(newPatient);
  res.json({ success: true, patient: newPatient });
});

app.post('/api/patients/:id/discharge', (req, res) => {
  const { id } = req.params;
  const patients = simulationEngine.getPatients();
  const patient = patients.find(p => p.id === id);

  if (!patient) return res.status(404).json({ error: "Patient not found" });

  const bed = wardBeds[patient.ward] && wardBeds[patient.ward].beds.find(b => b.bedId === patient.bedId);
  if (bed) {
    bed.status = 'available';
    bed.patientId = null;
  }

  simulationEngine.removePatient(id);
  currentPatientsData = currentPatientsData.filter(p => p.id !== id);

  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    patientId: id,
    event: "PATIENT_DISCHARGED",
    ward: patient.ward,
    bedId: patient.bedId,
    message: `Bed ${patient.bedId} is now available`
  }));

  res.json({
    success: true,
    message: `Patient ${id} discharged. Bed ${patient.bedId} is now available.`,
    bedId: patient.bedId
  });
});

app.get('/api/patients/:id', (req, res) => {
  const p = currentPatientsData.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Patient not found' });

  const alertHistory = alertEngine.getPatientAlerts(p.id);
  res.json({
    ...p,
    alertHistory
  });
});

// Historical vitals — used by the Recharts panel on each patient card.
// Returns up to `points` most recent snapshots (defaults to 60 ≈ last 3 minutes
// at the default tick rate; clinicians get a smooth ~10 min view at low speed).
app.get('/api/patients/:id/history', (req, res) => {
  const points = Math.max(1, Math.min(500, parseInt(req.query.points) || 200));
  const buffer = simulationEngine.getSnapshotBuffer(req.params.id);
  const trimmed = buffer.slice(-points).map(s => ({
    timestamp: s.timestamp,
    heartRate: s.vitals.heartRate,
    spo2: s.vitals.spo2,
    bloodPressure: s.vitals.bloodPressure,
    temperature: s.vitals.temperature
  }));
  res.json({ patientId: req.params.id, points: trimmed });
});

// Black Box Playback — returns the buffered snapshots so the frontend can roll
// back UI state second-by-second. Defaults to the last 5 minutes.
app.get('/api/patients/:id/playback', (req, res) => {
  const windowSec = Math.max(10, Math.min(900, parseInt(req.query.windowSec) || 300));
  const buffer = simulationEngine.getSnapshotBuffer(req.params.id, windowSec * 1000);
  res.json({
    patientId: req.params.id,
    windowSec,
    tickIntervalMs: currentTickMs,
    snapshots: buffer
  });
});

app.get('/api/alerts', (req, res) => {
  res.json(alertEngine.getActiveAlerts());
});

app.get('/api/alerts/history', (req, res) => {
  res.json(alertEngine.getAlertsHistory());
});

app.get('/api/wards', (req, res) => {
  const wardsData = {};
  currentPatientsData.forEach(p => {
    if (!wardsData[p.ward]) {
      wardsData[p.ward] = { ward: p.ward, patientCount: 0, sumHeartRate: 0, criticalCount: 0 };
    }
    wardsData[p.ward].patientCount++;
    wardsData[p.ward].sumHeartRate += p.vitals.heartRate;
    if (p.status === 'CRITICAL') {
      wardsData[p.ward].criticalCount++;
    }
  });

  const result = Object.values(wardsData).map(w => ({
    ward: w.ward,
    patientCount: w.patientCount,
    avgHeartRate: w.patientCount > 0 ? Math.round(w.sumHeartRate / w.patientCount) : 0,
    criticalCount: w.criticalCount
  }));
  res.json(result);
});

// --- Chaos Dashboard endpoints ----------------------------------------------
// Trigger simulated mass-casualty / infrastructure failure events. Used to
// stress-test the cluster and watch the HPA spin up new pods.
app.get('/api/admin/chaos/status', (req, res) => {
  res.json({
    ...simulationEngine.getChaosStatus(),
    tickIntervalMs: currentTickMs,
    patientCount: currentPatientsData.length
  });
});

app.post('/api/admin/chaos', (req, res) => {
  const { type } = req.body || {};

  if (type === 'speed') {
    const multiplier = Number(req.body.multiplier) || 10;
    const applied = simulationEngine.setSpeedMultiplier(multiplier);
    startTickLoop();
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: "CHAOS_SPEED_CHANGE",
      multiplier: applied,
      tickIntervalMs: currentTickMs
    }));
    return res.json({ success: true, type, multiplier: applied, tickIntervalMs: currentTickMs });
  }

  if (type === 'power_failure') {
    const ward = req.body.ward || 'ICU';
    const durationSec = Number(req.body.durationSec) || 30;
    if (!wardBeds[ward]) return res.status(400).json({ error: "Invalid ward" });
    simulationEngine.triggerPowerFailure(ward, durationSec);
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: "CHAOS_POWER_FAILURE",
      ward,
      durationSec
    }));
    return res.json({ success: true, type, ward, durationSec });
  }

  if (type === 'surge') {
    const ward = req.body.ward || 'Emergency';
    const durationSec = Number(req.body.durationSec) || 60;
    if (!wardBeds[ward]) return res.status(400).json({ error: "Invalid ward" });
    simulationEngine.triggerSurge(ward, durationSec);
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: "CHAOS_VITAL_SURGE",
      ward,
      durationSec
    }));
    return res.json({ success: true, type, ward, durationSec });
  }

  if (type === 'mass_admission') {
    const ward = req.body.ward || 'Emergency';
    const count = Math.max(1, Math.min(100, Number(req.body.count) || 50));
    if (!wardBeds[ward]) return res.status(400).json({ error: "Invalid ward" });

    const admitted = [];
    for (let i = 0; i < count; i++) {
      const newPatientId = `P${String(nextPatientId++).padStart(3, '0')}`;
      const chaosBedId = `${ward.slice(0, 3).toUpperCase()}-CHAOS-${i + 1}-${Date.now().toString().slice(-4)}`;
      wardBeds[ward].beds.push({ bedId: chaosBedId, status: 'occupied', patientId: newPatientId });
      wardBeds[ward].totalBeds += 1;

      const newPatient = {
        id: newPatientId,
        name: `Surge Patient ${newPatientId}`,
        age: 20 + Math.floor(Math.random() * 60),
        condition: 'Critical',
        ward,
        bedId: chaosBedId,
        offset: Math.floor(Math.random() * 30) - 5,
        admittedAt: new Date().toISOString()
      };
      simulationEngine.addPatient(newPatient);
      admitted.push(newPatientId);
    }

    // Also trigger a vital surge so the new patients trip alerts dramatically.
    simulationEngine.triggerSurge(ward, 90);

    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: "CHAOS_MASS_ADMISSION",
      ward,
      count,
      newPatients: admitted
    }));
    return res.json({ success: true, type, ward, count, admitted });
  }

  if (type === 'reset') {
    simulationEngine.resetChaos();
    startTickLoop();
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: "CHAOS_RESET"
    }));
    return res.json({ success: true, type: 'reset', tickIntervalMs: currentTickMs });
  }

  return res.status(400).json({ error: `Unknown chaos type: ${type}` });
});

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', metricsExporter.register.contentType);
    res.end(await metricsExporter.register.metrics());
  } catch (ex) {
    res.status(500).end(ex.message);
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`VitalWatch Backend running on port ${PORT}`);
});
