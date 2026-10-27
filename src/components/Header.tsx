import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, BatteryCharging, Wifi, ShieldAlert, CheckCircle2, AlertOctagon } from 'lucide-react';
import { TelemetryData } from '../types';

interface HeaderProps {
  activeTab: string;
  telemetry: TelemetryData | null;
  systemStatus: 'NORMAL' | 'WARNING' | 'CRITICAL';
  isDemoMode: boolean;
  onOpenRelayModal: () => void;
  relayArmed: boolean;
  activeAlertCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  telemetry,
  systemStatus,
  isDemoMode,
  onOpenRelayModal,
  relayArmed,
  activeAlertCount,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toTimeString().split(' ')[0] + ' UTC' + (now.getTimezoneOffset() <= 0 ? '+' : '-') + Math.abs(now.getTimezoneOffset()/60));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const tabTitles: Record<string, string> = {
    dashboard: 'Real-Time Sensor Telemetry',
    robot: 'ESP32 Robot & Bluetooth Teleoperation',
    camera: 'ESP32-CAM Stream & Fallback Resolver',
    ai_detection: 'YOLO Fire & Smoke Neural Detection',
    history: 'Historical Sensor Telemetry & Analytics',
    settings: 'System Configuration & Safety Thresholds',
    docs: 'Hardware Wiring & Integration Manual',
  };

  return (
    <header className="border-b border-zinc-800 bg-[#090d16]/95 backdrop-blur-md sticky top-0 z-30">
      {/* Critical Alert Warning Strip if CRITICAL */}
      {systemStatus === 'CRITICAL' && (
        <div className="bg-red-600 text-white px-4 py-1.5 flex items-center justify-between text-xs font-mono font-bold animate-pulse">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4" />
            <span>CRITICAL FIRE/GAS HAZARD ACTIVE - IMMEDIATE OPERATOR ATTENTION REQUIRED</span>
          </div>
          <button
            onClick={onOpenRelayModal}
            className="bg-black/40 hover:bg-black/60 px-2.5 py-0.5 rounded text-[11px] underline tracking-wider"
          >
            ACTUATE SUPPRESSION PUMP
          </button>
        </div>
      )}

      {/* Demo Mode Notice */}
      {isDemoMode && (
        <div className="bg-amber-950/60 border-b border-amber-500/40 text-amber-300 px-4 py-1 flex items-center justify-between text-[11px] font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span className="font-semibold">DEMO SIMULATION ACTIVE:</span>
            <span className="text-amber-200/80">Sensor values are simulated for hardware-free inspection. Toggle off in Settings.</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-900/60 border border-amber-600/40">
            SIMULATED TELEMETRY
          </span>
        </div>
      )}

      {/* Main Bar */}
      <div className="px-6 py-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-base font-bold font-mono tracking-wider text-zinc-100 uppercase">
              {tabTitles[activeTab] || 'Telemetry Control'}
            </h1>
            {activeAlertCount > 0 && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/40">
                {activeAlertCount} ALERTS
              </span>
            )}
          </div>
          <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
            NODE: <span className="text-zinc-200">{telemetry?.deviceId || 'ESP32-NODE-01'}</span>
            {' • '}
            LINK: <span className="text-emerald-400 font-semibold">{telemetry ? 'ACTIVE' : 'STANDBY'}</span>
            {telemetry?.timestamp && (
              <>
                {' • '}
                SYNC: <span className="text-zinc-300">{new Date(telemetry.timestamp).toLocaleTimeString()}</span>
              </>
            )}
          </div>
        </div>

        {/* Right Info Cluster */}
        <div className="flex items-center gap-4 text-xs font-mono">
          {/* Battery Status */}
          {telemetry?.battery_mv && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
              <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
              <span>{(telemetry.battery_mv / 1000).toFixed(2)}V</span>
            </div>
          )}

          {/* Clock */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            <span>{currentTime || '00:00:00'}</span>
          </div>

          {/* Quick Suppression Status */}
          <button
            onClick={onOpenRelayModal}
            className={`flex items-center gap-2 px-3 py-1 rounded border text-xs font-bold transition-all ${
              relayArmed
                ? 'bg-red-500/20 border-red-500/50 text-red-300 hover:bg-red-500/30'
                : 'bg-zinc-900 border-zinc-700/60 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            <ShieldAlert className={`w-3.5 h-3.5 ${relayArmed ? 'text-red-400' : 'text-zinc-400'}`} />
            <span>RELAY: {relayArmed ? 'ARMED' : 'SAFE'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
