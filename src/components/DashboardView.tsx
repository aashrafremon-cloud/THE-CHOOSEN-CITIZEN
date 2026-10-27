import React, { useState } from 'react';
import { 
  Flame, 
  Wind, 
  Thermometer, 
  Droplets, 
  Volume2, 
  MapPin, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle, 
  Zap, 
  RefreshCw,
  Compass,
  ArrowUpRight,
  TrendingUp,
  Cpu
} from 'lucide-react';
import { TelemetryData, AlertEvent } from '../types';

interface DashboardViewProps {
  telemetry: TelemetryData | null;
  history: TelemetryData[];
  alerts: AlertEvent[];
  systemStatus: 'NORMAL' | 'WARNING' | 'CRITICAL';
  isDemoMode: boolean;
  onSendTestPacket: () => void;
  onOpenRelayModal: () => void;
  onSwitchToTab: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  telemetry,
  history,
  alerts,
  systemStatus,
  isDemoMode,
  onSendTestPacket,
  onOpenRelayModal,
  onSwitchToTab,
}) => {
  const [selectedChartMetric, setSelectedChartMetric] = useState<'all' | 'temp' | 'co' | 'hum'>('all');

  // Fallback defaults if no telemetry received yet
  const t = telemetry || {
    id: 'standby',
    deviceId: 'ESP32-NODE-01',
    timestamp: new Date().toISOString(),
    temperature: 24.0,
    humidity: 48.0,
    mq7_co_ppm: 14.5,
    flame_detected: false,
    flame_raw: 3950,
    sound_db: 42.0,
    gps: { lat: 37.7749, lng: -122.4194, altitude: 15.0, satellites: 7 },
    relay_active: false,
    status: 'NORMAL' as const,
  };

  // Danger Score Calculation (0-100)
  let dangerScore = 5;
  if (t.flame_detected) dangerScore += 55;
  if (t.mq7_co_ppm > 150) dangerScore += 35;
  else if (t.mq7_co_ppm > 50) dangerScore += 18;
  if (t.temperature > 60) dangerScore += 30;
  else if (t.temperature > 45) dangerScore += 15;
  if (t.sound_db > 80) dangerScore += 10;
  dangerScore = Math.min(100, dangerScore);

  // Chart coordinate helper for SVG
  const chartPoints = history.length > 1 ? history.slice(-30) : [];
  const maxTemp = Math.max(...chartPoints.map((p) => p.temperature), 50);
  const minTemp = Math.min(...chartPoints.map((p) => p.temperature), 15);
  const maxCo = Math.max(...chartPoints.map((p) => p.mq7_co_ppm), 100);

  const getPointsSvg = (metricKey: 'temperature' | 'mq7_co_ppm' | 'humidity', yMax: number, yMin: number = 0) => {
    if (chartPoints.length < 2) return '';
    const width = 600;
    const height = 180;
    const stepX = width / (chartPoints.length - 1);

    return chartPoints
      .map((p, i) => {
        const val = p[metricKey] as number;
        const normalizedY = height - ((val - yMin) / (yMax - yMin || 1)) * (height - 20) - 10;
        return `${i * stepX},${Math.max(5, Math.min(height - 5, normalizedY))}`;
      })
      .join(' ');
  };

  return (
    <div className="space-y-6">
      {/* Top Threat & Node Status Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Composite Threat Score */}
        <div className="bg-[#0e1422] border border-zinc-800 rounded-xl p-4 flex items-center justify-between shadow-lg">
          <div>
            <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
              Composite Hazard Index
            </div>
            <div className="text-2xl font-black font-mono tracking-tight text-zinc-100 mt-1 flex items-baseline gap-2">
              <span className={dangerScore > 65 ? 'text-red-400' : dangerScore > 35 ? 'text-amber-400' : 'text-emerald-400'}>
                {dangerScore}%
              </span>
              <span className="text-xs font-normal text-zinc-500">
                {dangerScore > 65 ? 'CRITICAL HAZARD' : dangerScore > 35 ? 'ELEVATED RISK' : 'NORMAL'}
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-44 h-1.5 bg-zinc-800 rounded-full mt-2.5 overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${
                  dangerScore > 65 ? 'bg-red-500' : dangerScore > 35 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${dangerScore}%` }}
              />
            </div>
          </div>
          <div className={`p-3 rounded-xl border ${
            dangerScore > 65 
              ? 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse'
              : dangerScore > 35
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          }`}>
            <Flame className="w-6 h-6" />
          </div>
        </div>

        {/* Optical Flame State */}
        <div className="bg-[#0e1422] border border-zinc-800 rounded-xl p-4 flex items-center justify-between shadow-lg">
          <div>
            <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
              Flame Sensor (KY-026)
            </div>
            <div className="text-xl font-bold font-mono tracking-tight text-zinc-100 mt-1 flex items-center gap-2">
              {t.flame_detected ? (
                <span className="text-red-400 flex items-center gap-1.5 animate-pulse">
                  <Flame className="w-5 h-5 fill-current" />
                  FLAME DETECTED
                </span>
              ) : (
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  NO FLAME
                </span>
              )}
            </div>
            <div className="text-[11px] text-zinc-500 font-mono mt-1">
              ADC Raw: <span className="text-zinc-300 font-semibold">{t.flame_raw}</span> / 4095
            </div>
          </div>
          <div className={`p-3 rounded-xl border ${
            t.flame_detected 
              ? 'bg-red-500/20 border-red-500/50 text-red-400' 
              : 'bg-zinc-800/40 border-zinc-700/50 text-zinc-400'
          }`}>
            <Zap className="w-6 h-6" />
          </div>
        </div>

        {/* MQ-7 Gas Level Quick View */}
        <div className="bg-[#0e1422] border border-zinc-800 rounded-xl p-4 flex items-center justify-between shadow-lg">
          <div>
            <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
              Carbon Monoxide (MQ-7)
            </div>
            <div className="text-2xl font-black font-mono tracking-tight text-zinc-100 mt-1 flex items-baseline gap-1.5">
              <span className={t.mq7_co_ppm > 150 ? 'text-red-400' : t.mq7_co_ppm > 50 ? 'text-amber-400' : 'text-zinc-100'}>
                {t.mq7_co_ppm.toFixed(1)}
              </span>
              <span className="text-xs font-semibold text-zinc-400">PPM</span>
            </div>
            <div className="text-[11px] font-mono text-zinc-500 mt-1">
              Thresholds: <span className="text-amber-400">50</span> / <span className="text-red-400">150 ppm</span>
            </div>
          </div>
          <div className={`p-3 rounded-xl border ${
            t.mq7_co_ppm > 150 
              ? 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse'
              : t.mq7_co_ppm > 50
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
              : 'bg-zinc-800/40 border-zinc-700/50 text-zinc-400'
          }`}>
            <Wind className="w-6 h-6" />
          </div>
        </div>

        {/* Ambient Temperature Quick View */}
        <div className="bg-[#0e1422] border border-zinc-800 rounded-xl p-4 flex items-center justify-between shadow-lg">
          <div>
            <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
              Ambient Temperature (DHT22)
            </div>
            <div className="text-2xl font-black font-mono tracking-tight text-zinc-100 mt-1 flex items-baseline gap-1.5">
              <span className={t.temperature > 60 ? 'text-red-400' : t.temperature > 45 ? 'text-amber-400' : 'text-zinc-100'}>
                {t.temperature.toFixed(1)}°C
              </span>
              <span className="text-xs text-zinc-500 font-semibold">
                ({(t.temperature * 1.8 + 32).toFixed(1)}°F)
              </span>
            </div>
            <div className="text-[11px] font-mono text-zinc-500 mt-1">
              Humidity: <span className="text-zinc-300 font-semibold">{t.humidity.toFixed(1)}%</span>
            </div>
          </div>
          <div className={`p-3 rounded-xl border ${
            t.temperature > 60
              ? 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse'
              : t.temperature > 45
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
              : 'bg-zinc-800/40 border-zinc-700/50 text-zinc-400'
          }`}>
            <Thermometer className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Grid: Detailed Telemetry Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: MQ-7 Carbon Monoxide Detailed Gauges */}
        <div className="bg-[#0e1422] border border-zinc-800 rounded-xl p-5 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20">
                <Wind className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-mono text-sm font-bold text-zinc-100">MQ-7 GAS SENSOR</h3>
                <p className="text-[10px] text-zinc-400 font-mono">Carbon Monoxide (CO) Concentration</p>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
              t.mq7_co_ppm > 150 ? 'bg-red-500 text-white' : t.mq7_co_ppm > 50 ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-emerald-400'
            }`}>
              {t.mq7_co_ppm > 150 ? 'DANGER' : t.mq7_co_ppm > 50 ? 'WARNING' : 'SAFE'}
            </span>
          </div>

          <div className="py-6 flex flex-col items-center justify-center">
            <div className="text-5xl font-black font-mono tracking-tight text-zinc-100">
              {t.mq7_co_ppm.toFixed(1)}
            </div>
            <div className="text-xs font-mono text-zinc-400 uppercase tracking-widest mt-1">
              Parts Per Million (PPM)
            </div>

            {/* Segmented Bar Indicator */}
            <div className="w-full mt-6 space-y-2">
              <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                <span>0 ppm (Clean)</span>
                <span className="text-amber-400">50 ppm (Alarm)</span>
                <span className="text-red-400">200+ ppm (Lethal)</span>
              </div>
              <div className="w-full h-3 bg-zinc-900 rounded-md overflow-hidden p-0.5 border border-zinc-800 flex gap-1">
                <div 
                  className="h-full rounded-sm bg-gradient-to-r from-emerald-500 via-amber-500 to-red-600 transition-all duration-300"
                  style={{ width: `${Math.min(100, (t.mq7_co_ppm / 200) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-800/80 text-xs font-mono">
            <div className="p-2 rounded bg-zinc-900/60 border border-zinc-800/60">
              <div className="text-[10px] text-zinc-400">HEATER CYCLE</div>
              <div className="text-zinc-200 font-semibold mt-0.5">HIGH 5V / LOW 1.4V</div>
            </div>
            <div className="p-2 rounded bg-zinc-900/60 border border-zinc-800/60">
              <div className="text-[10px] text-zinc-400">CALIBRATION R0</div>
              <div className="text-zinc-200 font-semibold mt-0.5">10.2 kΩ Nominal</div>
            </div>
          </div>
        </div>

        {/* Card 2: DHT22 Climate & Thermal Runaway */}
        <div className="bg-[#0e1422] border border-zinc-800 rounded-xl p-5 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                <Thermometer className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-mono text-sm font-bold text-zinc-100">DHT22 CLIMATE NODE</h3>
                <p className="text-[10px] text-zinc-400 font-mono">Calibrated Digital Temp & Humidity</p>
              </div>
            </div>
            <span className="text-[10px] font-mono text-zinc-400">GPIO 4</span>
          </div>

          <div className="grid grid-cols-2 gap-4 py-5">
            {/* Temperature Tile */}
            <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800/80 flex flex-col items-center">
              <span className="text-[10px] font-mono text-zinc-400 uppercase">Temperature</span>
              <span className={`text-3xl font-black font-mono mt-1 ${
                t.temperature > 60 ? 'text-red-400' : t.temperature > 45 ? 'text-amber-400' : 'text-zinc-100'
              }`}>
                {t.temperature.toFixed(1)}°C
              </span>
              <span className="text-[11px] font-mono text-zinc-400 mt-0.5">
                {(t.temperature * 1.8 + 32).toFixed(1)}°F
              </span>
              <div className="w-full bg-zinc-800 h-1 rounded-full mt-3 overflow-hidden">
                <div 
                  className="bg-red-500 h-full"
                  style={{ width: `${Math.min(100, (t.temperature / 80) * 100)}%` }}
                />
              </div>
            </div>

            {/* Humidity Tile */}
            <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800/80 flex flex-col items-center">
              <span className="text-[10px] font-mono text-zinc-400 uppercase">Rel Humidity</span>
              <span className="text-3xl font-black font-mono text-zinc-100 mt-1">
                {t.humidity.toFixed(1)}%
              </span>
              <span className="text-[11px] font-mono text-zinc-400 mt-0.5">
                {t.humidity < 30 ? 'Dry (Fire Spread)' : 'Normal RH'}
              </span>
              <div className="w-full bg-zinc-800 h-1 rounded-full mt-3 overflow-hidden">
                <div 
                  className="bg-cyan-500 h-full"
                  style={{ width: `${Math.min(100, t.humidity)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800/60 text-xs font-mono flex items-center justify-between text-zinc-400">
            <span>HEAT INDEX:</span>
            <span className="text-zinc-200 font-bold">
              {(t.temperature + (t.humidity * 0.1)).toFixed(1)}°C Apparent
            </span>
            <span>DEW POINT:</span>
            <span className="text-zinc-200 font-bold">
              {(t.temperature - ((100 - t.humidity) / 5)).toFixed(1)}°C
            </span>
          </div>
        </div>

        {/* Card 3: Acoustic Noise & GPS Location */}
        <div className="bg-[#0e1422] border border-zinc-800 rounded-xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Volume2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-mono text-sm font-bold text-zinc-100">AUDIO & TELEMETRY</h3>
                  <p className="text-[10px] text-zinc-400 font-mono">Decibel Level & GPS Position</p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-zinc-400">ADC 32 / UART 2</span>
            </div>

            {/* Sound Decibel Level */}
            <div className="py-4">
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <span className="text-zinc-400">ACOUSTIC LEVEL</span>
                <span className={`font-bold ${t.sound_db > 80 ? 'text-red-400 animate-pulse' : 'text-zinc-200'}`}>
                  {t.sound_db.toFixed(1)} dB {t.sound_db > 80 && '(SIREN DETECTED)'}
                </span>
              </div>
              {/* Dynamic Sound Equalizer Bar */}
              <div className="grid grid-cols-12 gap-1 h-3">
                {Array.from({ length: 12 }).map((_, i) => {
                  const threshold = 30 + (i * 6.5);
                  const isLit = t.sound_db >= threshold;
                  return (
                    <div
                      key={i}
                      className={`h-full rounded-xs transition-all duration-150 ${
                        isLit
                          ? i > 8
                            ? 'bg-red-500 shadow-[0_0_6px_#ef4444]'
                            : i > 5
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                          : 'bg-zinc-800'
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            {/* GPS Location Data */}
            <div className="pt-3 border-t border-zinc-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-red-400" />
                  GPS FIX (NEO-6M):
                </span>
                <span className="text-zinc-300 font-semibold">
                  {t.gps.satellites ?? 6} SATELLITES
                </span>
              </div>
              <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800/60 font-mono text-xs text-zinc-300 flex items-center justify-between">
                <span>LAT: {t.gps.lat.toFixed(5)}</span>
                <span>LNG: {t.gps.lng.toFixed(5)}</span>
                <span>ALT: {t.gps.altitude?.toFixed(0) ?? 15}m</span>
              </div>
            </div>
          </div>

          <div className="pt-3 flex gap-2">
            <button
              onClick={() => onSwitchToTab('camera')}
              className="flex-1 py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-mono font-semibold text-zinc-200 flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>OPEN CAMERA FEED</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400" />
            </button>
            <button
              onClick={() => onSwitchToTab('ai_detection')}
              className="flex-1 py-2 px-3 rounded-lg bg-red-950/40 hover:bg-red-900/50 border border-red-500/30 text-xs font-mono font-semibold text-red-300 flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>YOLO AI ROOM</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Real-Time Telemetry Trend Chart */}
      <div className="bg-[#0e1422] border border-zinc-800 rounded-xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-zinc-800/80 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-mono text-sm font-bold text-zinc-100">REAL-TIME SENSOR STREAM</h3>
              <p className="text-[10px] text-zinc-400 font-mono">Live Time-Series: Temperature, Humidity, and Carbon Monoxide</p>
            </div>
          </div>

          {/* Metric Selector Tabs */}
          <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs font-mono">
            <button
              onClick={() => setSelectedChartMetric('all')}
              className={`px-2.5 py-1 rounded transition-colors ${
                selectedChartMetric === 'all' ? 'bg-zinc-700 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              ALL
            </button>
            <button
              onClick={() => setSelectedChartMetric('temp')}
              className={`px-2.5 py-1 rounded transition-colors ${
                selectedChartMetric === 'temp' ? 'bg-red-500/20 text-red-400 font-bold border border-red-500/40' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              TEMP (°C)
            </button>
            <button
              onClick={() => setSelectedChartMetric('co')}
              className={`px-2.5 py-1 rounded transition-colors ${
                selectedChartMetric === 'co' ? 'bg-amber-500/20 text-amber-400 font-bold border border-amber-500/40' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              CO (PPM)
            </button>
            <button
              onClick={() => setSelectedChartMetric('hum')}
              className={`px-2.5 py-1 rounded transition-colors ${
                selectedChartMetric === 'hum' ? 'bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/40' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              HUMIDITY (%)
            </button>
          </div>
        </div>

        {/* SVG Chart Canvas */}
        <div className="py-4">
          {chartPoints.length > 1 ? (
            <div className="w-full h-48 bg-[#090d16] rounded-lg border border-zinc-800/80 p-3 relative overflow-hidden flex flex-col justify-between">
              {/* Grid Lines */}
              <div className="absolute inset-x-3 inset-y-3 flex flex-col justify-between pointer-events-none opacity-20">
                <div className="border-b border-zinc-600 border-dashed w-full" />
                <div className="border-b border-zinc-600 border-dashed w-full" />
                <div className="border-b border-zinc-600 border-dashed w-full" />
                <div className="border-b border-zinc-600 border-dashed w-full" />
              </div>

              {/* SVG Polyline paths */}
              <svg className="w-full h-full overflow-visible" viewBox="0 0 600 180" preserveAspectRatio="none">
                {/* Temperature Polyline (Red) */}
                {(selectedChartMetric === 'all' || selectedChartMetric === 'temp') && (
                  <polyline
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={getPointsSvg('temperature', maxTemp + 5, 0)}
                  />
                )}

                {/* Carbon Monoxide Polyline (Amber) */}
                {(selectedChartMetric === 'all' || selectedChartMetric === 'co') && (
                  <polyline
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={getPointsSvg('mq7_co_ppm', maxCo + 10, 0)}
                  />
                )}

                {/* Humidity Polyline (Cyan) */}
                {(selectedChartMetric === 'all' || selectedChartMetric === 'hum') && (
                  <polyline
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                    points={getPointsSvg('humidity', 100, 0)}
                  />
                )}
              </svg>

              {/* Chart Legend */}
              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-2 z-10 border-t border-zinc-800/60">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-red-400">
                    <span className="w-2.5 h-0.5 bg-red-500 inline-block" />
                    Temp ({t.temperature.toFixed(1)}°C)
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <span className="w-2.5 h-0.5 bg-amber-500 inline-block" />
                    CO ({t.mq7_co_ppm.toFixed(1)} ppm)
                  </span>
                  <span className="flex items-center gap-1.5 text-cyan-400">
                    <span className="w-2.5 h-0.5 bg-cyan-400 inline-block" />
                    Humidity ({t.humidity.toFixed(1)}%)
                  </span>
                </div>
                <span>WINDOW: LAST {chartPoints.length} SAMPLES</span>
              </div>
            </div>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-lg text-zinc-400 font-mono text-xs gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-zinc-400" />
              <span>Awaiting sensor telemetry points from ESP32...</span>
              <button
                onClick={onSendTestPacket}
                className="mt-2 px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-sans font-medium"
              >
                Send Test Ingest Packet Now
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Active Alerts & System Notification Feed */}
      <div className="bg-[#0e1422] border border-zinc-800 rounded-xl p-5 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-zinc-400" />
            <h3 className="font-mono text-sm font-bold text-zinc-100">SYSTEM LOG & ALARM STREAM</h3>
          </div>
          <span className="text-[11px] font-mono text-zinc-400">
            {alerts.length} RECORDED EVENTS
          </span>
        </div>

        <div className="divide-y divide-zinc-800/60 mt-2 max-h-56 overflow-y-auto">
          {alerts.length > 0 ? (
            alerts.slice(0, 5).map((evt) => (
              <div key={evt.id} className="py-2.5 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    evt.severity === 'CRITICAL'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                      : evt.severity === 'WARNING'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {evt.severity}
                  </span>
                  <div>
                    <span className="font-bold text-zinc-200">{evt.title}</span>
                    <span className="text-zinc-400 ml-2 hidden sm:inline">{evt.description}</span>
                  </div>
                </div>
                <div className="text-[11px] text-zinc-400 shrink-0">
                  {new Date(evt.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))
          ) : (
            <div className="py-6 text-center text-zinc-400 font-mono text-xs">
              No hazard alerts registered. All sensors within normal baseline parameters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
