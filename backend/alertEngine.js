const alertsHistory = [];
const activeAlerts = new Map(); // patientId -> array of active alerts

function standardDeviation(arr) {
  const n = arr.length;
  const mean = arr.reduce((a, b) => a + b) / n;
  return Math.sqrt(arr.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n);
}

function evaluateAlerts(patient, vitals, history, timestamp) {
  const newAlerts = [];

  // LEVEL 1: Threshold
  if (vitals.heartRate > 120) newAlerts.push({ level: "CRITICAL", type: "THRESHOLD", message: "Tachycardia detected", vital: "heartRate", timestamp });
  else if (vitals.heartRate < 50) newAlerts.push({ level: "CRITICAL", type: "THRESHOLD", message: "Bradycardia detected", vital: "heartRate", timestamp });

  if (vitals.bloodPressure > 140) newAlerts.push({ level: "WARNING", type: "THRESHOLD", message: "Hypertension detected", vital: "bloodPressure", timestamp });
  else if (vitals.bloodPressure < 80) newAlerts.push({ level: "CRITICAL", type: "THRESHOLD", message: "Hypotension detected", vital: "bloodPressure", timestamp });

  if (vitals.spo2 < 90) newAlerts.push({ level: "CRITICAL", type: "THRESHOLD", message: "Hypoxia detected – immediate attention required", vital: "spo2", timestamp });
  else if (vitals.spo2 < 94) newAlerts.push({ level: "WARNING", type: "THRESHOLD", message: "Low oxygen saturation", vital: "spo2", timestamp });

  if (vitals.temperature > 39.0) newAlerts.push({ level: "WARNING", type: "THRESHOLD", message: "Fever detected", vital: "temperature", timestamp });
  else if (vitals.temperature < 35.0) newAlerts.push({ level: "CRITICAL", type: "THRESHOLD", message: "Hypothermia detected", vital: "temperature", timestamp });

  // LEVEL 2: Correlation
  if (vitals.heartRate > 110 && vitals.bloodPressure < 85) newAlerts.push({ level: "CRITICAL", type: "CORRELATION", message: "Shock pattern detected", vital: "multiple", timestamp });
  if (vitals.temperature > 38.5 && vitals.heartRate > 100) newAlerts.push({ level: "WARNING", type: "CORRELATION", message: "Sepsis indicator detected", vital: "multiple", timestamp });
  if (vitals.spo2 < 92 && vitals.heartRate > 105) newAlerts.push({ level: "CRITICAL", type: "CORRELATION", message: "Respiratory distress pattern", vital: "multiple", timestamp });

  // LEVEL 3: Trend
  if (history.length >= 4) {
    const last4 = history.slice(-4).map(h => h.spo2);
    if (last4[0] > last4[1] && last4[1] > last4[2] && last4[2] > last4[3]) {
      newAlerts.push({ level: "WARNING", type: "TREND", message: "Deteriorating trend: SpO2 declining", vital: "spo2", timestamp });
    }
  }

  if (history.length === 5) {
    const avgSpo2 = history.reduce((sum, h) => sum + h.spo2, 0) / 5;
    if (vitals.spo2 < avgSpo2 - 4) {
      newAlerts.push({ level: "WARNING", type: "TREND", message: "SpO2 deviation from baseline", vital: "spo2", timestamp });
    }

    const vitalsKeys = ["heartRate", "bloodPressure", "spo2", "temperature"];
    vitalsKeys.forEach(key => {
      const vals = history.map(h => h[key]);
      const mean = vals.reduce((a, b) => a + b) / 5;
      const stdDev = standardDeviation(vals);
      if (stdDev > 0 && Math.abs(vitals[key] - mean) > 2 * stdDev) {
        newAlerts.push({ level: "WARNING", type: "TREND", message: "Anomaly: Unexpected vital change", vital: key, timestamp });
      }
    });
  }

  // Deduplicate and process new alerts
  const uniqueAlerts = newAlerts.filter((v, i, a) => a.findIndex(t => (t.message === v.message)) === i);
  
  uniqueAlerts.forEach(alert => {
    // Log to console as required
    console.log(JSON.stringify({
      timestamp,
      patientId: patient.id,
      event: "ALERT_TRIGGERED",
      severity: alert.level,
      message: alert.message,
      vitals
    }));

    // Add to global history
    const historyAlert = { ...alert, patientId: patient.id };
    alertsHistory.unshift(historyAlert);
    if (alertsHistory.length > 50) alertsHistory.pop();
  });

  activeAlerts.set(patient.id, uniqueAlerts);
  
  let overallStatus = "INFO";
  if (uniqueAlerts.some(a => a.level === "CRITICAL")) overallStatus = "CRITICAL";
  else if (uniqueAlerts.some(a => a.level === "WARNING")) overallStatus = "WARNING";

  return { activeAlerts: uniqueAlerts, overallStatus };
}

function getActiveAlerts() {
  const allActive = [];
  activeAlerts.forEach((alerts, patientId) => {
    alerts.forEach(a => allActive.push({ ...a, patientId }));
  });
  return allActive;
}

function getAlertsHistory() {
  return alertsHistory.slice(0, 20); // return last 20
}

function getPatientAlerts(patientId) {
  return alertsHistory.filter(a => a.patientId === patientId).slice(0, 10);
}

module.exports = {
  evaluateAlerts,
  getActiveAlerts,
  getAlertsHistory,
  getPatientAlerts
};
