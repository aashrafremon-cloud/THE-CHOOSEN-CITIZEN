import React from 'react';
import { 
  Flame, 
  Activity, 
  Video, 
  BrainCircuit, 
  LineChart, 
  Settings, 
  BookOpen, 
  ShieldAlert, 
  Volume2, 
  VolumeX, 
  Radio, 
  Cpu,
  Power,
  Bot
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  systemStatus: 'NORMAL' | 'WARNING' | 'CRITICAL';
  deviceConnected: boolean;
  isDemoMode: boolean;
  audioEnabled: boolean;
  toggleAudio: () => void;
  relayArmed: boolean;
  onOpenRelayModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  systemStatus,
  deviceConnected,
  isDemoMode,
  audioEnabled,
  toggleAudio,
  relayArmed,
  onOpenRelayModal,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity, badge: null },
    { id: 'robot', label: 'Robot & Bluetooth', icon: Bot, badge: 'BT' },
    { id: 'camera', label: 'Live Camera', icon: Video, badge: null },
    { id: 'ai_detection', label: 'AI Fire Detection', icon: BrainCircuit, badge: 'YOLO' },
    { id: 'history', label: 'History & Analytics', icon: LineChart, badge: null },
    { id: 'settings', label: 'Settings', icon: Settings, badge: null },
    { id: 'docs', label: 'Docs & ESP32 Code', icon: BookOpen, badge: null },
  ];

  return (
    <aside className="w-64 bg-[#0d121c] border-r border-zinc-800 flex flex-col justify-between shrink-0 select-none">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold shadow-lg transition-all ${
              systemStatus === 'CRITICAL'
                ? 'bg-red-600 text-white shadow-red-600/40 animate-pulse'
                : systemStatus === 'WARNING'
                ? 'bg-amber-500 text-black shadow-amber-500/30'
                : 'bg-gradient-to-br from-red-500 to-amber-600 text-white shadow-red-500/20'
            }`}>
              <Flame className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="font-mono font-black text-sm tracking-widest text-zinc-100 flex items-center gap-1.5">
                FIREGUARD <span className="text-red-400 font-bold">AI</span>
              </div>
              <div className="text-[10px] text-zinc-400 font-mono tracking-wider">
                ESP32 INDUSTRIAL IOT
              </div>
            </div>
          </div>
        </div>

        {/* System Status Pill */}
        <div className="px-4 py-3 border-b border-zinc-800/50 bg-[#080c14]">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${
                isDemoMode
                  ? 'bg-amber-400 animate-pulse'
                  : deviceConnected
                  ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
                  : 'bg-zinc-600'
              }`} />
              {isDemoMode ? 'DEMO MODE' : deviceConnected ? 'ESP32 ONLINE' : 'NO SENSOR FEED'}
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
              systemStatus === 'CRITICAL'
                ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                : systemStatus === 'WARNING'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}>
              {systemStatus}
            </span>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="p-3 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium font-sans tracking-wide transition-all ${
                  isActive
                    ? 'bg-red-500/15 text-red-400 border border-red-500/30 shadow-inner shadow-red-500/10'
                    : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-red-400' : 'text-zinc-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Safety Interlock & Controls Footer */}
      <div className="p-3.5 border-t border-zinc-800/80 bg-[#090d16] space-y-2.5">
        {/* Safety Pump Relay Status */}
        <button
          onClick={onOpenRelayModal}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-mono transition-all ${
            relayArmed
              ? 'bg-red-950/40 border-red-500/60 text-red-300 hover:bg-red-900/50'
              : 'bg-zinc-900/80 border-zinc-700/60 text-zinc-400 hover:bg-zinc-800/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <ShieldAlert className={`w-3.5 h-3.5 ${relayArmed ? 'text-red-400 animate-pulse' : 'text-zinc-500'}`} />
            <span className="text-[11px] font-semibold">SUPPRESSION RELAY</span>
          </div>
          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
            relayArmed ? 'bg-red-500 text-white' : 'bg-zinc-800 text-zinc-400'
          }`}>
            {relayArmed ? 'ARMED' : 'SAFE'}
          </span>
        </button>

        {/* Audio Mute & Telemetry Heartbeat */}
        <div className="flex items-center justify-between px-1">
          <button
            onClick={toggleAudio}
            className={`flex items-center gap-1.5 text-[11px] font-mono transition-colors ${
              audioEnabled ? 'text-zinc-300 hover:text-white' : 'text-zinc-500 hover:text-zinc-400'
            }`}
            title="Toggle Alert Sounds"
          >
            {audioEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>ALERTS ON</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-zinc-500" />
                <span>MUTED</span>
              </>
            )}
          </button>

          <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
            <Radio className="w-3 h-3 text-red-400 animate-pulse" />
            LIVE 433/WIFI
          </span>
        </div>
      </div>
    </aside>
  );
};
