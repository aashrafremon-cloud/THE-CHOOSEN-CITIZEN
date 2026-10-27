/**
 * FIREGUARD AI - API Client Service
 */

import { TelemetryData, AlertEvent, AppSettings, DetectionResult } from '../types';

export const API_BASE = '';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  return res.json();
}

export async function fetchSettings(): Promise<AppSettings> {
  const res = await fetch(`${API_BASE}/api/settings`);
  if (!res.ok) throw new Error('Failed to load settings');
  return res.json();
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  const res = await fetch(`${API_BASE}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to save settings');
  const data = await res.json();
  return data.settings;
}

export async function fetchLatestTelemetry(): Promise<TelemetryData | null> {
  const res = await fetch(`${API_BASE}/api/esp32/telemetry/latest`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchTelemetryHistory(limit = 60): Promise<TelemetryData[]> {
  const res = await fetch(`${API_BASE}/api/esp32/telemetry/history?limit=${limit}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.records || [];
}

export async function postTelemetry(payload: Partial<TelemetryData>): Promise<any> {
  const res = await fetch(`${API_BASE}/api/esp32/telemetry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function fetchEvents(severity?: string, limit = 100): Promise<AlertEvent[]> {
  const url = severity && severity !== 'ALL' 
    ? `${API_BASE}/api/events?severity=${severity}&limit=${limit}`
    : `${API_BASE}/api/events?limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.events || [];
}

export async function probeCameraEndpoints(ip: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/camera/test-endpoints?ip=${encodeURIComponent(ip)}`);
  if (!res.ok) throw new Error('Failed to probe camera endpoints');
  return res.json();
}

export async function runAIInference(imageBase64: string, engine?: string, confidenceThreshold?: number): Promise<DetectionResult> {
  const res = await fetch(`${API_BASE}/api/ai/infer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, engine, confidenceThreshold }),
  });
  if (!res.ok) throw new Error('AI inference failed');
  return res.json();
}

export async function runGeminiVerification(imageBase64: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/ai/gemini-verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64 }),
  });
  if (!res.ok) throw new Error('Gemini verification failed');
  return res.json();
}

export async function controlRelay(payload: { activate: boolean; armed: boolean; autoOffSeconds?: number }): Promise<any> {
  const res = await fetch(`${API_BASE}/api/relay/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to control relay');
  }
  return res.json();
}
