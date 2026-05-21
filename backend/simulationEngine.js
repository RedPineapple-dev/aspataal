let patients = [
  { id: "P001", name: "Patient P001", age: 45, ward: "ICU", bedId: "ICU-1", offset: 0, admittedAt: new Date().toISOString() },
  { id: "P002", name: "Patient P002", age: 62, ward: "ICU", bedId: "ICU-2", offset: 8, admittedAt: new Date().toISOString() },
  { id: "P003", name: "Patient P003", age: 34, ward: "General", bedId: "GEN-1", offset: -5, admittedAt: new Date().toISOString() },
  { id: "P004", name: "Patient P004", age: 50, ward: "General", bedId: "GEN-2", offset: 12, admittedAt: new Date().toISOString() },
  { id: "P005", name: "Patient P005", age: 28, ward: "Emergency", bedId: "EMR-1", offset: 15, admittedAt: new Date().toISOString() },
  { id: "P006", name: "Patient P006", age: 71, ward: "Emergency", bedId: "EMR-2", offset: -3, admittedAt: new Date().toISOString() }
];

const patientHistory = {}; // rolling history of last 5 readings (used by alertEngine for trend detection)
patients.forEach(p => patientHistory[p.id] = []);

// Black-box ring buffer: per-patient snapshot history. Keeps last ~10 minutes (200 entries at 3s ticks).
const SNAPSHOT_BUFFER_SIZE = 200;
const snapshotBuffer = {};
patients.forEach(p => snapshotBuffer[p.id] = []);

// Chaos state — controls how vitals are generated for stress / failure scenarios
const chaosState = {
  speedMultiplier: 1,
  powerFailureWards: {}, // ward -> expiresAt (ms)
  surgeWards: {}         // ward -> expiresAt (ms): pushes vitals toward critical thresholds
};

function isPowerFailed(ward) {
  const expiry = chaosState.powerFailureWards[ward];
  if (!expiry) return false;
  if (Date.now() > expiry) {
    delete chaosState.powerFailureWards[ward];
    return false;
  }
  return true;
}

function isSurging(ward) {
  const expiry = chaosState.surgeWards[ward];
  if (!expiry) return false;
  if (Date.now() > expiry) {
    delete chaosState.surgeWards[ward];
    return false;
  }
  return true;
}

function generateVitals(patient, timestamp) {
  // Power failure: monitors offline — vitals return as 0 / NaN-like sentinels (critical alerts will trip)
  if (isPowerFailed(patient.ward)) {
    return {
      heartRate: 0,
      bloodPressure: 0,
      spo2: 0,
      temperature: 0,
      monitorOffline: true
    };
  }

  const t = new Date(timestamp).getMinutes();
  const noise = () => (Math.random() - 0.5) * 5;
  const offset = patient.offset;

  let heartRate     = 80  + offset * 0.3 + 10  * Math.sin((t * Math.PI) / 30) + noise();
  let bloodPressure = 110 + offset * 0.2 + 8   * Math.sin((t * Math.PI) / 30) + noise();
  let spo2          = 97  + 1.5 * Math.sin((t * Math.PI) / 30) + noise() * 0.3;
  let temperature   = 37  + 0.4 * Math.sin((t * Math.PI) / 30) + noise() * 0.05;

  // Surge: push vitals toward critical thresholds for the affected ward (simulates mass-casualty stress)
  if (isSurging(patient.ward)) {
    heartRate     += 35 + Math.random() * 15;
    bloodPressure -= 25 + Math.random() * 10;
    spo2          -= 8  + Math.random() * 3;
    temperature   += 1.2 + Math.random() * 0.5;
  }

  return {
    heartRate:     Math.round(heartRate),
    bloodPressure: Math.round(bloodPressure),
    spo2:          parseFloat(spo2.toFixed(1)),
    temperature:   parseFloat(temperature.toFixed(1))
  };
}

function updateVitals() {
  const timestamp = new Date().toISOString();

  return patients.map(p => {
    const vitals = generateVitals(p, timestamp);

    patientHistory[p.id].push(vitals);
    if (patientHistory[p.id].length > 5) {
      patientHistory[p.id].shift();
    }

    return {
      ...p,
      vitals,
      timestamp
    };
  });
}

// Append a full snapshot {timestamp, vitals, alerts, status} to the black-box ring buffer.
function recordSnapshot(patientId, snapshot) {
  if (!snapshotBuffer[patientId]) snapshotBuffer[patientId] = [];
  snapshotBuffer[patientId].push(snapshot);
  if (snapshotBuffer[patientId].length > SNAPSHOT_BUFFER_SIZE) {
    snapshotBuffer[patientId].shift();
  }
}

function getSnapshotBuffer(patientId, sinceMs) {
  const buf = snapshotBuffer[patientId] || [];
  if (!sinceMs) return buf.slice();
  const cutoff = Date.now() - sinceMs;
  return buf.filter(s => new Date(s.timestamp).getTime() >= cutoff);
}

function getPatients() {
  return patients;
}

function getHistory(patientId) {
  return patientHistory[patientId] || [];
}

function addPatient(patient) {
  patients.push(patient);
  patientHistory[patient.id] = [];
  snapshotBuffer[patient.id] = [];
}

function removePatient(patientId) {
  patients = patients.filter(p => p.id !== patientId);
  delete patientHistory[patientId];
  delete snapshotBuffer[patientId];
}

// --- Chaos controls -------------------------------------------------
function setSpeedMultiplier(multiplier) {
  const m = Math.max(0.1, Math.min(20, Number(multiplier) || 1));
  chaosState.speedMultiplier = m;
  return m;
}

function getSpeedMultiplier() {
  return chaosState.speedMultiplier;
}

function triggerPowerFailure(ward, durationSec) {
  chaosState.powerFailureWards[ward] = Date.now() + (Number(durationSec) || 30) * 1000;
}

function triggerSurge(ward, durationSec) {
  chaosState.surgeWards[ward] = Date.now() + (Number(durationSec) || 60) * 1000;
}

function resetChaos() {
  chaosState.speedMultiplier = 1;
  chaosState.powerFailureWards = {};
  chaosState.surgeWards = {};
}

function getChaosStatus() {
  const now = Date.now();
  const powerFailures = Object.entries(chaosState.powerFailureWards)
    .filter(([, exp]) => exp > now)
    .map(([ward, exp]) => ({ ward, remainingSec: Math.round((exp - now) / 1000) }));
  const surges = Object.entries(chaosState.surgeWards)
    .filter(([, exp]) => exp > now)
    .map(([ward, exp]) => ({ ward, remainingSec: Math.round((exp - now) / 1000) }));
  return {
    speedMultiplier: chaosState.speedMultiplier,
    powerFailures,
    surges
  };
}

module.exports = {
  updateVitals,
  getPatients,
  getHistory,
  addPatient,
  removePatient,
  recordSnapshot,
  getSnapshotBuffer,
  setSpeedMultiplier,
  getSpeedMultiplier,
  triggerPowerFailure,
  triggerSurge,
  resetChaos,
  getChaosStatus
};
