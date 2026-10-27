import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, Power, X, Check, Lock, Unlock, Clock } from 'lucide-react';
import { controlRelay } from '../services/api';

interface RelaySafetyModalProps {
  isOpen: boolean;
  onClose: () => void;
  isArmed: boolean;
  setIsArmed: (val: boolean) => void;
  isRelayActive: boolean;
  onRelayStateChanged: (active: boolean) => void;
}

export const RelaySafetyModal: React.FC<RelaySafetyModalProps> = ({
  isOpen,
  onClose,
  isArmed,
  setIsArmed,
  isRelayActive,
  onRelayStateChanged,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30);
  const [autoOffSeconds, setAutoOffSeconds] = useState<number>(30);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRelayActive) {
      setSecondsRemaining(autoOffSeconds);
      interval = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(interval!);
            onRelayStateChanged(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setSecondsRemaining(autoOffSeconds);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRelayActive, autoOffSeconds]);

  if (!isOpen) return null;

  const handleToggleRelay = async (activate: boolean) => {
    if (activate && !isArmed) {
      setErrorMsg('Safety interlock must be armed before pump activation.');
      return;
    }
    setErrorMsg(null);
    setIsLoading(true);
    try {
      await controlRelay({
        activate,
        armed: isArmed,
        autoOffSeconds,
      });
      onRelayStateChanged(activate);
    } catch (err: any) {
      setErrorMsg(err.message || 'Relay control error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-mono">
      <div className="w-full max-w-lg bg-[#0e1422] border border-red-500/40 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-4 bg-red-950/40 border-b border-red-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-red-400">
            <ShieldAlert className="w-5 h-5 animate-pulse" />
            <h3 className="text-sm font-bold tracking-wider">HARDWARE RELAY SAFETY INTERLOCK</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-xs text-zinc-300">
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              PHYSICAL ACTUATOR SAFETY RESTRICTION
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              This switch directly commands the physical 5V/12V water suppression solenoid valve or dry chemical extinguisher relay on ESP32 GPIO 23.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-950 border border-red-600 text-red-200 text-xs font-bold">
              {errorMsg}
            </div>
          )}

          {/* Armed Safety Toggle */}
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="font-bold text-zinc-100 flex items-center gap-2">
                {isArmed ? <Unlock className="w-4 h-4 text-amber-400" /> : <Lock className="w-4 h-4 text-zinc-500" />}
                <span>ARM INTERLOCK SWITCH</span>
              </div>
              <p className="text-[10px] text-zinc-400">
                Operator confirmation required prior to electrical energization
              </p>
            </div>

            <button
              onClick={() => {
                setIsArmed(!isArmed);
                setErrorMsg(null);
              }}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors border ${
                isArmed
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
              }`}
            >
              {isArmed ? 'ARMED' : 'SAFE (DISARMED)'}
            </button>
          </div>

          {/* Auto-off Timeout Slider */}
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                Auto-Shutoff Maximum Duration:
              </span>
              <span className="text-zinc-100 font-bold">{autoOffSeconds} seconds</span>
            </div>
            <input
              type="range"
              min="5"
              max="90"
              step="5"
              value={autoOffSeconds}
              disabled={isRelayActive}
              onChange={(e) => setAutoOffSeconds(parseInt(e.target.value, 10))}
              className="w-full accent-red-500"
            />
            <span className="text-[10px] text-zinc-400 block">
              Protects pump motors against dry-run overheating and excessive flooding.
            </span>
          </div>

          {/* Active Status Display */}
          {isRelayActive && (
            <div className="p-4 rounded-xl bg-red-950/60 border border-red-500 text-center space-y-2 animate-pulse">
              <div className="text-lg font-black text-red-300">
                RELAY ENERGIZED - PUMP DISCHARGING
              </div>
              <div className="text-2xl font-black text-white">
                AUTO-CUTOFF IN: {secondsRemaining}s
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-bold transition-colors"
          >
            DISMISS
          </button>

          {isRelayActive ? (
            <button
              onClick={() => handleToggleRelay(false)}
              disabled={isLoading}
              className="px-6 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-red-400 border border-red-500/50 text-xs font-black flex items-center gap-2 shadow-lg transition-colors"
            >
              <Power className="w-4 h-4 text-red-400" />
              <span>EMERGENCY CUTOFF (SHUT OFF)</span>
            </button>
          ) : (
            <button
              onClick={() => handleToggleRelay(true)}
              disabled={!isArmed || isLoading}
              className="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-red-600/40 transition-colors disabled:opacity-40"
            >
              <Power className="w-4 h-4 fill-current" />
              <span>ACTUATE SUPPRESSION PUMP</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
