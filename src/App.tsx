/**
 * FIREGUARD AI - Main Application Controller
 * Real-Time ESP32 IoT Monitoring & AI Fire & Smoke Detection Dashboard
 */

import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { LiveCameraView } from './components/LiveCameraView';
import { AIFireDetectionView } from './components/AIFireDetectionView';
import { HistoryAnalyticsView } from './components/HistoryAnalyticsView';
import { SettingsView } from './components/SettingsView';
import { DocsView } from './components/DocsView';
import { RelaySafetyModal } from './components/RelaySafetyModal';
import { RobotControlView } from './components/RobotControlView';

import { TelemetryData, AlertEvent, AppSettings, DetectionBox } from './types';
import { 
  fetchSettings, 
  saveSettings, 
  fetchLatestTelemetry, 
  fetchTelemetryHistory, 
  fetchEvents, 
  postTelemetry 
} from './services/api';
import { audioAlert } from './services/audioAlert';
import { generateSimulatedTelemetry } from './services/simulation';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Core system settings
  const [settings, setSettings] = useState<AppSettings>({
    deviceId: 'ESP32-NODE-01',
    apiKey: '',
    esp32Endpoint: '/api/esp32/telemetry',
    cameraIp: '192.168.1.80',
    cameraCustomUrl: '',
    cameraStreamPort: 81,
    cameraStreamPath: '/stream',
    cameraSnapshotPath: '/capture',
    snapshotIntervalMs: 350,
    streamTimeoutMs: 3000,
    autoFallback: true,
    aiBackendUrl: 'http://localhost:8000',
    aiEngine: 'builtin_cv',
    fireConfidenceThreshold: 0.45,
    smokeConfidenceThreshold: 0.50,
    minDetectionFrames: 2,
    coWarningPpm: 50,
    coCriticalPpm: 150,
    tempWarningC: 45,
    tempCriticalC: 60,
    soundAlertDb: 80,
    relaySafetyArmed: false,
    relayAutoOffSeconds: 30,
    audioAlertsEnabled: true,
    demoMode: false,
    demoScenario: 'normal',
  });

  // Telemetry & Sensor State
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [history, setHistory] = useState<TelemetryData[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [systemStatus, setSystemStatus] = useState<'NORMAL' | 'WARNING' | 'CRITICAL'>('NORMAL');
  const [deviceConnected, setDeviceConnected] = useState<boolean>(false);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);

  // Relay Interlock State
  const [relayArmed, setRelayArmed] = useState<boolean>(false);
  const [isRelayActive, setIsRelayActive] = useState<boolean>(false);
  const [isRelayModalOpen, setIsRelayModalOpen] = useState<boolean>(false);

  // Shared Camera Frame for AI Vision
  const [activeCameraFrame, setActiveCameraFrame] = useState<string | null>(null);

  // Heartbeat tracking
  const lastPacketTimeRef = useRef<number>(0);
  const sseRef = useRef<EventSource | null>(null);

  // Initial Data Bootstrap
  useEffect(() => {
    const initApp = async () => {
      try {
        const loadedSettings = await fetchSettings();
        setSettings((prev) => ({ ...prev, ...loadedSettings }));
        setAudioEnabled(loadedSettings.audioAlertsEnabled ?? true);
        setRelayArmed(loadedSettings.relaySafetyArmed ?? false);
      } catch (e) {
        console.warn('Using default settings.');
      }

      try {
        const latest = await fetchLatestTelemetry();
        if (latest) {
          setTelemetry(latest);
          setSystemStatus(latest.status);
          lastPacketTimeRef.current = Date.now();
          setDeviceConnected(true);
        }
      } catch {}

      try {
        const hist = await fetchTelemetryHistory(60);
        setHistory(hist);
      } catch {}

      try {
        const evts = await fetchEvents();
        setAlerts(evts);
      } catch {}
    };

    initApp();
  }, []);

  // Connect to Server-Sent Events (SSE) for Real-Time Sensor Stream
  useEffect(() => {
    let sse: EventSource | null = null;
    try {
      sse = new EventSource('/api/stream/events');
      sseRef.current = sse;

      sse.addEventListener('telemetry', (e) => {
        try {
          const data: TelemetryData = JSON.parse(e.data);
          setTelemetry(data);
          setSystemStatus(data.status);
          lastPacketTimeRef.current = Date.now();
          setDeviceConnected(true);

          setHistory((prev) => {
            const next = [...prev, data];
            return next.slice(-60);
          });

          // Audio alert check
          if (data.status === 'CRITICAL') {
            audioAlert.playFireSiren();
          } else if (data.status === 'WARNING') {
            audioAlert.playWarningBeep();
          } else {
            audioAlert.stopAlarm();
          }
        } catch (err) {
          console.error('SSE telemetry parse error:', err);
        }
      });

      sse.addEventListener('alert', (e) => {
        try {
          const alertData: AlertEvent = JSON.parse(e.data);
          setAlerts((prev) => [alertData, ...prev].slice(0, 100));
          if (alertData.severity === 'CRITICAL') {
            audioAlert.playFireSiren();
          } else if (alertData.severity === 'WARNING') {
            audioAlert.playWarningBeep();
          }
        } catch {}
      });

      sse.addEventListener('relay', (e) => {
        try {
          const rState = JSON.parse(e.data);
          setIsRelayActive(Boolean(rState.active));
          if (rState.armed !== undefined) setRelayArmed(Boolean(rState.armed));
        } catch {}
      });

      sse.addEventListener('settings', (e) => {
        try {
          const newSettings = JSON.parse(e.data);
          setSettings((prev) => ({ ...prev, ...newSettings }));
        } catch {}
      });

      sse.onerror = () => {
        // Fallback polling will handle if SSE disconnects
      };
    } catch (err) {
      console.warn('SSE not supported, running polling fallback.');
    }

    return () => {
      if (sse) sse.close();
    };
  }, []);

  // Device Link Heartbeat Check
  useEffect(() => {
    const timer = setInterval(() => {
      if (settings.demoMode) {
        setDeviceConnected(true);
        return;
      }
      const diff = Date.now() - lastPacketTimeRef.current;
      if (diff > 8000) {
        setDeviceConnected(false);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [settings.demoMode]);

  // Demo Simulation Generator Loop (Only active when demoMode === true)
  useEffect(() => {
    if (!settings.demoMode) return;

    const simTimer = setInterval(async () => {
      const simData = generateSimulatedTelemetry(settings.demoScenario || 'normal');
      try {
        await postTelemetry(simData);
      } catch (err) {
        console.warn('Simulation ingest error:', err);
      }
    }, 2000);

    return () => clearInterval(simTimer);
  }, [settings.demoMode, settings.demoScenario]);

  // Settings Save Handler
  const handleSaveSettings = async (updated: Partial<AppSettings>) => {
    const saved = await saveSettings(updated);
    setSettings((prev) => ({ ...prev, ...saved }));
    if (saved.audioAlertsEnabled !== undefined) {
      setAudioEnabled(saved.audioAlertsEnabled);
      audioAlert.setEnabled(saved.audioAlertsEnabled);
    }
  };

  // Toggle Audio Mute
  const toggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    audioAlert.setEnabled(next);
    handleSaveSettings({ audioAlertsEnabled: next });
  };

  // Send Manual Test Packet
  const handleSendTestPacket = async () => {
    const sample: Partial<TelemetryData> = {
      deviceId: settings.deviceId || 'ESP32-NODE-01',
      temperature: 28.5 + Number((Math.random() * 4).toFixed(1)),
      humidity: 46.0 + Number((Math.random() * 6).toFixed(1)),
      mq7_co_ppm: 22.0 + Number((Math.random() * 15).toFixed(1)),
      flame_detected: false,
      flame_raw: 3920,
      sound_db: 45.0 + Number((Math.random() * 8).toFixed(1)),
      gps: { lat: 37.774929, lng: -122.419416, altitude: 15.0, satellites: 8 },
    };
    await postTelemetry(sample);
  };

  // Handle Detection Trigger from AI view
  const handleFireAlertTriggered = (box: DetectionBox) => {
    if (audioEnabled) {
      audioAlert.playFireSiren();
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#070a10] text-zinc-100 font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        systemStatus={systemStatus}
        deviceConnected={deviceConnected}
        isDemoMode={settings.demoMode}
        audioEnabled={audioEnabled}
        toggleAudio={toggleAudio}
        relayArmed={relayArmed}
        onOpenRelayModal={() => setIsRelayModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header */}
        <Header
          activeTab={activeTab}
          telemetry={telemetry}
          systemStatus={systemStatus}
          isDemoMode={settings.demoMode}
          onOpenRelayModal={() => setIsRelayModalOpen(true)}
          relayArmed={relayArmed}
          activeAlertCount={alerts.filter((a) => a.severity === 'CRITICAL').length}
        />

        {/* Tab Viewport */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === 'dashboard' && (
            <DashboardView
              telemetry={telemetry}
              history={history}
              alerts={alerts}
              systemStatus={systemStatus}
              isDemoMode={settings.demoMode}
              onSendTestPacket={handleSendTestPacket}
              onOpenRelayModal={() => setIsRelayModalOpen(true)}
              onSwitchToTab={setActiveTab}
            />
          )}

          {activeTab === 'robot' && (
            <RobotControlView
              telemetry={telemetry}
              onUpdateTelemetry={(incoming) => {
                setTelemetry((prev) => {
                  if (!prev) return incoming as TelemetryData;
                  return { ...prev, ...incoming };
                });
                setDeviceConnected(true);
                lastPacketTimeRef.current = Date.now();
              }}
              onSwitchTab={setActiveTab}
            />
          )}

          {activeTab === 'camera' && (
            <LiveCameraView
              settings={settings}
              onUpdateSettings={handleSaveSettings}
              onFrameCaptured={setActiveCameraFrame}
            />
          )}

          {activeTab === 'ai_detection' && (
            <AIFireDetectionView
              settings={settings}
              onUpdateSettings={handleSaveSettings}
              activeFrameBase64={activeCameraFrame}
              onFireAlertTriggered={handleFireAlertTriggered}
            />
          )}

          {activeTab === 'history' && (
            <HistoryAnalyticsView
              history={history}
              events={alerts}
              onRefreshHistory={async () => {
                const h = await fetchTelemetryHistory(100);
                setHistory(h);
                const ev = await fetchEvents();
                setAlerts(ev);
              }}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              onSaveSettings={handleSaveSettings}
            />
          )}

          {activeTab === 'docs' && (
            <DocsView onSendTestPacket={handleSendTestPacket} />
          )}
        </main>
      </div>

      {/* Suppression Relay Safety Modal */}
      <RelaySafetyModal
        isOpen={isRelayModalOpen}
        onClose={() => setIsRelayModalOpen(false)}
        isArmed={relayArmed}
        setIsArmed={setRelayArmed}
        isRelayActive={isRelayActive}
        onRelayStateChanged={setIsRelayActive}
      />
    </div>
  );
}
