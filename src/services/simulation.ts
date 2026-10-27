/**
 * Clearly labeled Simulation / Demo Mode telemetry generator
 * Allows testing and inspecting dashboard behavior when physical ESP32 hardware is not yet powered on.
 */

import { TelemetryData } from '../types';

let simStep = 0;

export function generateSimulatedTelemetry(scenario: string = 'normal'): Partial<TelemetryData> {
  simStep++;
  const timestamp = new Date().toISOString();

  let temp = 24.2 + Math.sin(simStep * 0.1) * 0.8;
  let humidity = 48.0 + Math.cos(simStep * 0.08) * 1.5;
  let coPpm = 12.0 + Math.sin(simStep * 0.15) * 3.0;
  let flameDetected = false;
  let flameRaw = 3980 + Math.floor(Math.sin(simStep) * 60);
  let soundDb = 42.0 + Math.random() * 4.0;
  let status: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL';

  if (scenario === 'gas_leak') {
    // Rising CO curve
    const cycle = (simStep % 30) / 30;
    coPpm = 35.0 + cycle * 140.0;
    if (coPpm > 150) status = 'CRITICAL';
    else if (coPpm > 50) status = 'WARNING';
  } else if (scenario === 'high_temp') {
    const cycle = (simStep % 30) / 30;
    temp = 32.0 + cycle * 45.0;
    if (temp > 60) status = 'CRITICAL';
    else if (temp > 45) status = 'WARNING';
  } else if (scenario === 'active_fire') {
    flameDetected = true;
    flameRaw = 412; // low ADC = strong IR detection
    temp = 64.5 + Math.random() * 8.0;
    coPpm = 180.0 + Math.random() * 25.0;
    status = 'CRITICAL';
  } else if (scenario === 'evac_alarm') {
    flameDetected = true;
    flameRaw = 320;
    temp = 71.0;
    coPpm = 220.0;
    soundDb = 94.0 + Math.random() * 3.0; // Loud siren
    status = 'CRITICAL';
  }

  return {
    deviceId: 'ESP32-DEMO-SIM',
    timestamp,
    temperature: Number(temp.toFixed(1)),
    humidity: Number(humidity.toFixed(1)),
    mq7_co_ppm: Number(coPpm.toFixed(1)),
    flame_detected: flameDetected,
    flame_raw: flameRaw,
    sound_db: Number(soundDb.toFixed(1)),
    gps: {
      lat: 37.774929 + Math.sin(simStep * 0.01) * 0.0001,
      lng: -122.419416 + Math.cos(simStep * 0.01) * 0.0001,
      altitude: 18.5,
      satellites: 8,
      speed: 0.0,
    },
    battery_mv: 3820,
    relay_active: false,
    status,
    is_simulated: true,
  };
}
