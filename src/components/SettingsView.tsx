import React, { useState } from 'react';
import { 
  Settings, 
  Save, 
  Cpu, 
  Video, 
  BrainCircuit, 
  Sliders, 
  ShieldAlert, 
  RotateCcw, 
  Check, 
  Radio, 
  BellRing,
  AlertTriangle,
  Info
} from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsViewProps {
  settings: AppSettings;
  onSaveSettings: (updated: Partial<AppSettings>) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
}) => {
  const [form, setForm] = useState<AppSettings>({ ...settings });
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);
    try {
      await onSaveSettings(form);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
      {/* Top Header */}
      <div className="bg-[#0e1422] border border-zinc-800 rounded-xl p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-mono text-sm font-bold text-zinc-100 flex items-center gap-2">
            <Settings className="w-4 h-4 text-red-400" />
            FIREGUARD SYSTEM CONFIGURATION
          </h2>
          <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
            Configure ESP32 endpoints, camera IP fallback sequence, YOLO model parameters, and safety interlocks
          </p>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-bold flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all disabled:opacity-50"
        >
          {savedSuccess ? <Check className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
          <span>{savedSuccess ? 'SAVED TO DB' : isSaving ? 'SAVING...' : 'SAVE CONFIGURATION'}</span>
        </button>
      </div>

      {/* Demo Mode & Hardware Simulation Controls (Prominent & Clearly Labeled) */}
      <div className={`p-5 rounded-xl border transition-all ${
        form.demoMode
          ? 'bg-amber-950/20 border-amber-500/50 shadow-lg shadow-amber-950/30'
          : 'bg-[#0e1422] border-zinc-800 shadow-xl'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-zinc-800/80 gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg border ${
              form.demoMode ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}>
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-mono text-sm font-bold text-zinc-100">HARDWARE SIMULATION / DEMO MODE</h3>
              <p className="text-[10px] text-zinc-400 font-mono">
                When physical ESP32 or ESP32-CAM is offline, test sensor thresholds & alarm responses safely
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={form.demoMode}
              onChange={(e) => setForm({ ...form, demoMode: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            <span className="ml-3 text-xs font-mono font-bold text-zinc-200">
              {form.demoMode ? 'DEMO SIMULATION ON' : 'PHYSICAL HARDWARE ONLY'}
            </span>
          </label>
        </div>

        {form.demoMode && (
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-zinc-300 mb-1">
                Active Simulation Scenario
              </label>
              <select
                value={form.demoScenario || 'normal'}
                onChange={(e) => setForm({ ...form, demoScenario: e.target.value as any })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-hidden focus:border-amber-500"
              >
                <option value="normal">Normal Baseline (24°C, 48% RH, 12 ppm CO, No Flame)</option>
                <option value="gas_leak">Gas Leak (MQ-7 rising 35 → 160 ppm hazardous)</option>
                <option value="high_temp">Thermal Runaway (Temperature climbing to 75°C)</option>
                <option value="active_fire">Active Fire (Optical Flame sensor triggered + Heat)</option>
                <option value="evac_alarm">Multi-Hazard Evacuation (Flame + Gas + 94 dB Siren)</option>
              </select>
            </div>
            <div className="p-3 rounded-lg bg-black/40 border border-zinc-800 text-[11px] font-mono text-amber-200/80 flex items-center">
              All simulated telemetry packets are explicitly tagged with `is_simulated: true` and will never be confused with real physical sensor readings.
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: ESP32 IoT Node Settings */}
        <div className="bg-[#0e1422] border border-zinc-800 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-800/80">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <h3 className="font-mono text-sm font-bold text-zinc-100">ESP32 SENSOR NODE</h3>
          </div>

          <div>
            <label className="block text-xs font-mono text-zinc-400 mb-1">Device Identifier</label>
            <input
              type="text"
              value={form.deviceId}
              onChange={(e) => setForm({ ...form, deviceId: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-zinc-400 mb-1">Telemetry Ingestion Endpoint</label>
            <input
              type="text"
              value={form.esp32Endpoint}
              onChange={(e) => setForm({ ...form, esp32Endpoint: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100"
            />
            <span className="text-[10px] text-zinc-400 font-mono mt-1 block">
              Default: /api/esp32/telemetry (HTTP POST)
            </span>
          </div>

          <div>
            <label className="block text-xs font-mono text-zinc-400 mb-1">Node API Key (Optional Token)</label>
            <input
              type="text"
              value={form.apiKey || ''}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder="fg_live_esp32_secret"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100"
            />
          </div>
        </div>

        {/* Section 2: ESP32-CAM Stream & Fallback Tuning */}
        <div className="bg-[#0e1422] border border-zinc-800 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-800/80">
            <Video className="w-4 h-4 text-red-400" />
            <h3 className="font-mono text-sm font-bold text-zinc-100">ESP32-CAM STREAM FALLBACK</h3>
          </div>

          <div>
            <label className="block text-xs font-mono text-zinc-400 mb-1">Camera IP Address</label>
            <input
              type="text"
              value={form.cameraIp}
              onChange={(e) => setForm({ ...form, cameraIp: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-zinc-400 mb-1">Snapshot Polling Interval (ms)</label>
            <input
              type="number"
              min="150"
              max="2000"
              step="50"
              value={form.snapshotIntervalMs}
              onChange={(e) => setForm({ ...form, snapshotIntervalMs: parseInt(e.target.value, 10) })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100"
            />
            <span className="text-[10px] text-zinc-400 font-mono mt-1 block">
              Used when falling back from MJPEG to JPEG snapshot polling
            </span>
          </div>

          <div>
            <label className="block text-xs font-mono text-zinc-400 mb-1">Connection Timeout (ms)</label>
            <input
              type="number"
              min="1000"
              max="10000"
              step="500"
              value={form.streamTimeoutMs}
              onChange={(e) => setForm({ ...form, streamTimeoutMs: parseInt(e.target.value, 10) })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100"
            />
          </div>
        </div>

        {/* Section 3: AI Model & Detection Engine */}
        <div className="bg-[#0e1422] border border-zinc-800 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-800/80">
            <BrainCircuit className="w-4 h-4 text-purple-400" />
            <h3 className="font-mono text-sm font-bold text-zinc-100">AI DETECTION & YOLO ENGINE</h3>
          </div>

          <div>
            <label className="block text-xs font-mono text-zinc-400 mb-1">Inference Engine</label>
            <select
              value={form.aiEngine}
              onChange={(e) => setForm({ ...form, aiEngine: e.target.value as any })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100"
            >
              <option value="builtin_cv">Embedded High-Speed Computer Vision (Instant & Reliable)</option>
              <option value="local_fastapi">Local Python FastAPI YOLOv8 Service (Deep Neural Net)</option>
              <option value="gemini_multimodal">Gemini Multimodal AI Inspector</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono text-zinc-400 mb-1">Python FastAPI Backend URL</label>
            <input
              type="text"
              value={form.aiBackendUrl}
              onChange={(e) => setForm({ ...form, aiBackendUrl: e.target.value })}
              placeholder="http://localhost:8000 or Cloudflare Tunnel"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100"
            />
            <span className="text-[10px] text-zinc-400 font-mono mt-1 block">
              Points to local `python3 main.py` instance or ngrok / cloudflared tunnel
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-zinc-400 mb-1">Fire Confidence Cutoff</label>
              <input
                type="number"
                min="0.1"
                max="0.95"
                step="0.05"
                value={form.fireConfidenceThreshold}
                onChange={(e) => setForm({ ...form, fireConfidenceThreshold: parseFloat(e.target.value) })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-400 mb-1">Smoke Confidence Cutoff</label>
              <input
                type="number"
                min="0.1"
                max="0.95"
                step="0.05"
                value={form.smokeConfidenceThreshold}
                onChange={(e) => setForm({ ...form, smokeConfidenceThreshold: parseFloat(e.target.value) })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Sensor Thresholds & Suppression Safety */}
        <div className="bg-[#0e1422] border border-zinc-800 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-800/80">
            <Sliders className="w-4 h-4 text-amber-400" />
            <h3 className="font-mono text-sm font-bold text-zinc-100">SAFETY THRESHOLDS & RELAY</h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-zinc-400 mb-1">CO Warning (PPM)</label>
              <input
                type="number"
                value={form.coWarningPpm}
                onChange={(e) => setForm({ ...form, coWarningPpm: parseFloat(e.target.value) })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-400 mb-1">CO Critical (PPM)</label>
              <input
                type="number"
                value={form.coCriticalPpm}
                onChange={(e) => setForm({ ...form, coCriticalPpm: parseFloat(e.target.value) })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-zinc-400 mb-1">Temp Warning (°C)</label>
              <input
                type="number"
                value={form.tempWarningC}
                onChange={(e) => setForm({ ...form, tempWarningC: parseFloat(e.target.value) })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-400 mb-1">Temp Critical (°C)</label>
              <input
                type="number"
                value={form.tempCriticalC}
                onChange={(e) => setForm({ ...form, tempCriticalC: parseFloat(e.target.value) })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-800/80">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-mono text-zinc-300 font-bold">
                  Pump Auto-Shutoff Timeout
                </label>
                <span className="text-[10px] text-zinc-400 font-mono">
                  Guards against motor dry-run burnout
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={form.relayAutoOffSeconds}
                  onChange={(e) => setForm({ ...form, relayAutoOffSeconds: parseInt(e.target.value, 10) })}
                  className="w-20 bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-100 text-right"
                />
                <span className="text-xs font-mono text-zinc-400">sec</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};
