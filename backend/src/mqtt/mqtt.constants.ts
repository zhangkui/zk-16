export const MQTT_TOPICS = {
  VEHICLE_DATA_REPORT: 'vehicle/data/report',
  VEHICLE_DATA_BATCH: 'vehicle/data/batch',
  VEHICLE_STATUS: 'vehicle/status',
  VEHICLE_COMMAND: 'vehicle/command',
  FENCE_EVENT: 'fence/event',
  ALERT_EVENT: 'alert/event',
};

export const MQTT_TOPIC_PATTERNS = {
  VEHICLE_DATA_REPORT: 'vehicle/+/data/report',
  VEHICLE_STATUS: 'vehicle/+/status',
  VEHICLE_COMMAND: 'vehicle/+/command',
};
