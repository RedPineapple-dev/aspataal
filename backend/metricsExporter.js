const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const activeAlertsGauge = new client.Gauge({
  name: 'vitalwatch_active_alerts_total',
  help: 'Total active alerts right now'
});
register.registerMetric(activeAlertsGauge);

const criticalAlertsCounter = new client.Counter({
  name: 'vitalwatch_critical_alerts_total',
  help: 'Total critical alerts since startup'
});
register.registerMetric(criticalAlertsCounter);

const patientsMonitoredGauge = new client.Gauge({
  name: 'vitalwatch_patients_monitored',
  help: 'Number of patients being monitored'
});
register.registerMetric(patientsMonitoredGauge);
patientsMonitoredGauge.set(6);

const apiRequestsCounter = new client.Counter({
  name: 'vitalwatch_api_requests_total',
  help: 'Total API requests'
});
register.registerMetric(apiRequestsCounter);

const warningsTotalCounter = new client.Counter({
  name: 'vitalwatch_warnings_total',
  help: 'Total warning alerts since startup'
});
register.registerMetric(warningsTotalCounter);

const simSpeedGauge = new client.Gauge({
  name: 'vitalwatch_sim_speed_multiplier',
  help: 'Simulation engine speed multiplier (1 = normal, 10 = chaos)'
});
register.registerMetric(simSpeedGauge);
simSpeedGauge.set(1);

function updateAlertMetrics(activeAlerts, allAlertsInTick) {
  activeAlertsGauge.set(activeAlerts.length);

  allAlertsInTick.forEach(alert => {
    if (alert.level === 'CRITICAL') {
      criticalAlertsCounter.inc();
    } else if (alert.level === 'WARNING') {
      warningsTotalCounter.inc();
    }
  });
}

function recordApiRequest() {
  apiRequestsCounter.inc();
}

function updateSimSpeed(multiplier) {
  simSpeedGauge.set(multiplier);
}

function updatePatientsMonitored(count) {
  patientsMonitoredGauge.set(count);
}

module.exports = {
  register,
  updateAlertMetrics,
  recordApiRequest,
  updateSimSpeed,
  updatePatientsMonitored
};
