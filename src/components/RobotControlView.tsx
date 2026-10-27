import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bot, 
  Bluetooth, 
  BluetoothConnected, 
  BluetoothOff, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight, 
  Square, 
  ShieldAlert, 
  Flame, 
  Wind, 
  Volume2, 
  Compass, 
  Terminal, 
  Sliders, 
  CheckCircle, 
  AlertTriangle,
  RotateCcw,
  Zap,
  Info,
  ExternalLink
} from 'lucide-react';
import { bluetoothService, BluetoothConnectionType } from '../services/bluetooth';
import { TelemetryData } from '../types';

interface RobotControlViewProps {
  telemetry: TelemetryData | null;
  onUpdateTelemetry: (data: Partial<TelemetryData>) => void;
  onSwitchTab: (tab: string) => void;
}

export const RobotControlView: React.FC<RobotControlViewProps> = ({
  telemetry,
  onUpdateTelemetry,
  onSwitchTab,
}) => {
  const [btConnected, setBtConnected] = useState<boolean>(bluetoothService.isConnected());
  const [btDeviceName, setBtDeviceName] = useState<string>(bluetoothService.getDeviceName());
  const [btConnType, setBtConnType] = useState<BluetoothConnectionType>(bluetoothService.getConnectionType());
  const [activeCommand, setActiveCommand] = useState<string>('S');
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSupported = bluetoothService.isSupported();

  // Add log helper
  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [msg, ...prev].slice(0, 40));
  }, []);

  // Register Bluetooth callbacks
  useEffect(() => {
    bluetoothService.setCallbacks(
      (data) => {
        onUpdateTelemetry(data);
      },
      (connected, name, type, error) => {
        setBtConnected(connected);
        setBtDeviceName(name);
        setBtConnType(type);
        if (error) setErrorMessage(error);
        else setErrorMessage(null);
      },
      (msg) => {
        addLog(msg);
      }
    );
  }, [onUpdateTelemetry, addLog]);

  // Command sender
  const sendCmd = useCallback(async (cmd: string) => {
    setActiveCommand(cmd);
    if (bluetoothService.isConnected()) {
      await bluetoothService.sendCommand(cmd);
    } else {
      addLog(`[SIMULATED] Command sent: '${cmd}' (Connect Bluetooth for real robot)`);
    }
  }, [addLog]);

  // Keyboard navigation listener (W/A/S/D and Arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid triggering when user is typing in an input
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          e.preventDefault();
          if (activeCommand !== 'F') sendCmd('F');
          break;
        case 's':
        case 'arrowdown':
          e.preventDefault();
          if (activeCommand !== 'B') sendCmd('B');
          break;
        case 'a':
        case 'arrowleft':
          e.preventDefault();
          if (activeCommand !== 'L') sendCmd('L');
          break;
        case 'd':
        case 'arrowright':
          e.preventDefault();
          if (activeCommand !== 'R') sendCmd('R');
          break;
        case ' ':
          e.preventDefault();
          sendCmd('S');
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }
      if (['w', 'arrowup', 's', 'arrowdown', 'a', 'arrowleft', 'd', 'arrowright'].includes(e.key.toLowerCase())) {
        sendCmd('S');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeCommand, sendCmd]);

  const [targetBleName, setTargetBleName] = useState<string>('ESP32_Safety_Robot');
  const [scanAllDevices, setScanAllDevices] = useState<boolean>(false);

  // Connect BLE handler
  const handleConnectBLE = async (scanAll: boolean = false) => {
    setIsConnecting(true);
    setErrorMessage(null);
    try {
      await bluetoothService.connectBLE(targetBleName, scanAll);
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        setErrorMessage(`لم يتم العثور على جهاز باسم "${targetBleName}". تأكد من تشغيل الـ ESP32، أو اضغط على "بحث عن كل الأجهزة".`);
      } else {
        setErrorMessage(err.message || 'فشل الاتصال بالبلوتوث');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // Connect Serial handler
  const handleConnectSerial = async () => {
    setIsConnecting(true);
    setErrorMessage(null);
    try {
      await bluetoothService.connectSerial();
    } catch (err: any) {
      setErrorMessage(err.message || 'فشل الاتصال بالمنفذ التسلسلي');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await bluetoothService.disconnect();
    setActiveCommand('S');
  };

  const t = telemetry || {
    mq7_co_ppm: 14.5,
    flame_detected: false,
    flame_raw: 1420,
    sound_db: 42.0,
    temperature: 24.5,
    humidity: 48.0,
    status: 'NORMAL' as const,
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Top Banner */}
      <div className="bg-[#0e1422] border border-zinc-800 rounded-xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border ${
            btConnected 
              ? 'bg-blue-500/20 text-blue-400 border-blue-500/40 shadow-lg shadow-blue-500/20' 
              : 'bg-zinc-800 text-zinc-400 border-zinc-700'
          }`}>
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-mono text-base font-bold text-zinc-100 flex items-center gap-2">
              ESP32 ROBOT TELEOPERATION & BLUETOOTH
              <span className={`text-[10px] px-2 py-0.5 rounded border font-mono font-bold ${
                btConnected 
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' 
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}>
                {btConnected ? `CONNECTED (${btConnType.toUpperCase()})` : 'BLUETOOTH STANDBY'}
              </span>
            </h2>
            <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
              Control A4988 Dual Stepper Motors (F, B, L, R, S) and stream MQ-7, Flame, Sound, DHT22 & GPS over Bluetooth
            </p>
          </div>
        </div>

        {/* Bluetooth Connect Controls with Name Search */}
        <div className="flex flex-wrap items-center gap-2">
          {btConnected ? (
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-red-400 border border-red-500/40 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors"
            >
              <BluetoothOff className="w-4 h-4" />
              <span>DISCONNECT</span>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {/* Target Device Name Input */}
              <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs font-mono">
                <span className="text-zinc-500 text-[10px]">NAME:</span>
                <input 
                  type="text" 
                  value={targetBleName} 
                  onChange={(e) => setTargetBleName(e.target.value)}
                  className="bg-transparent text-zinc-100 font-bold focus:outline-hidden w-36 text-xs"
                  placeholder="ESP32_Safety_Robot"
                  title="اسم جهاز البلوتوث المحدد في كود ESP32"
                />
              </div>

              {/* Strict Name Search Button */}
              <button
                onClick={() => handleConnectBLE(false)}
                disabled={isConnecting}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-lg shadow-blue-600/30 transition-colors disabled:opacity-50"
                title={`بحث مخصص باسم الجهاز: ${targetBleName}`}
              >
                <Bluetooth className="w-4 h-4" />
                <span>{isConnecting ? 'جاري البحث...' : `CONNECT: ${targetBleName}`}</span>
              </button>

              {/* Scan All Nearby Devices Fallback */}
              <button
                onClick={() => handleConnectBLE(true)}
                disabled={isConnecting}
                className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-xs font-mono font-medium flex items-center gap-1.5 transition-colors"
                title="إظهار كافة أجهزة البلوتوث المجاورة بدون تقييد بالاسم"
              >
                <span>SCAN ALL</span>
              </button>

              {/* Serial / COM Port Fallback */}
              <button
                onClick={handleConnectSerial}
                disabled={isConnecting}
                className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-xs font-mono font-medium flex items-center gap-1.5 transition-colors"
                title="Connect via Bluetooth Serial / RFCOMM COM port"
              >
                <Terminal className="w-4 h-4 text-zinc-400" />
                <span>COM PORT</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Browser Support Warning if needed */}
      {(!isSupported.ble && !isSupported.serial) && (
        <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs font-mono flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            Web Bluetooth & Web Serial are supported in Google Chrome, Microsoft Edge, Opera, and Brave.
            If using Firefox or Safari, open this dashboard in Chrome to connect wirelessly.
          </span>
        </div>
      )}

      {/* In-Iframe Security Notice for Web Bluetooth */}
      {typeof window !== 'undefined' && window.self !== window.top && !btConnected && (
        <div className="p-3.5 rounded-xl bg-blue-950/40 border border-blue-500/40 text-blue-200 text-xs font-mono flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              نصيحة: متصفح Google Chrome يتطلب تشغيل البلوتوث في نافذة مستقلة (وليس داخل معاينة iFrame).
            </span>
          </div>
          <button
            onClick={() => window.open(window.location.href, '_blank')}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 transition-colors shrink-0 text-[11px]"
          >
            <span>فتح في نافذة كاملة</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500 text-red-200 text-xs font-mono flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {typeof window !== 'undefined' && window.self !== window.top && (
              <button
                onClick={() => window.open(window.location.href, '_blank')}
                className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] flex items-center gap-1"
              >
                <span>نافذة جديدة</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={() => handleConnectBLE(true)}
              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-[11px]"
            >
              SCAN ALL
            </button>
            <button onClick={() => setErrorMessage(null)} className="text-zinc-400 hover:text-white px-1">✕</button>
          </div>
        </div>
      )}

      {/* Main Grid: D-Pad Controller & Live Telemetry Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Virtual D-Pad Teleoperation (7 cols) */}
        <div className="lg:col-span-7 bg-[#0e1422] border border-zinc-800 rounded-xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-400" />
                <h3 className="font-mono text-sm font-bold text-zinc-100">
                  DUAL STEPPER MOTOR TELEOPERATION
                </h3>
              </div>
              <span className="text-[11px] font-mono text-zinc-400">
                ACTIVE CMD: <strong className="text-blue-400 font-mono text-sm">{activeCommand}</strong>
              </span>
            </div>

            {/* Safety Interlock Cutoff Warning */}
            {t.flame_detected && (
              <div className="mt-4 p-3 rounded-lg bg-red-950/60 border border-red-500/60 text-red-300 text-xs font-mono font-bold flex items-center gap-2 animate-pulse">
                <Flame className="w-4 h-4 text-red-400 shrink-0" />
                <span>FLAME SAFETY INTERLOCK ACTIVE: Stepper drivers disabled on GPIO 23!</span>
              </div>
            )}

            {/* Virtual Joystick / D-Pad UI */}
            <div className="py-8 flex flex-col items-center justify-center select-none">
              <div className="grid grid-cols-3 gap-3 w-64 max-w-full">
                {/* Row 1: Forward */}
                <div />
                <button
                  onClick={() => sendCmd('F')}
                  className={`h-20 rounded-xl border flex flex-col items-center justify-center font-mono font-bold text-xs transition-all ${
                    activeCommand === 'F'
                      ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/40 scale-95'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:border-zinc-500'
                  }`}
                >
                  <ArrowUp className="w-6 h-6 mb-1" />
                  <span>FORWARD</span>
                  <span className="text-[9px] text-zinc-400">[W / ↑]</span>
                </button>
                <div />

                {/* Row 2: Left, STOP, Right */}
                <button
                  onClick={() => sendCmd('L')}
                  className={`h-20 rounded-xl border flex flex-col items-center justify-center font-mono font-bold text-xs transition-all ${
                    activeCommand === 'L'
                      ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/40 scale-95'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:border-zinc-500'
                  }`}
                >
                  <ArrowLeft className="w-6 h-6 mb-1" />
                  <span>LEFT</span>
                  <span className="text-[9px] text-zinc-400">[A / ←]</span>
                </button>

                <button
                  onClick={() => sendCmd('S')}
                  className={`h-20 rounded-xl border flex flex-col items-center justify-center font-mono font-bold text-xs transition-all ${
                    activeCommand === 'S'
                      ? 'bg-red-600 border-red-400 text-white shadow-lg shadow-red-500/40'
                      : 'bg-red-950/40 border-red-700/60 text-red-300 hover:bg-red-900/60'
                  }`}
                >
                  <Square className="w-6 h-6 fill-current mb-1" />
                  <span>STOP</span>
                  <span className="text-[9px] text-red-200">[SPACE]</span>
                </button>

                <button
                  onClick={() => sendCmd('R')}
                  className={`h-20 rounded-xl border flex flex-col items-center justify-center font-mono font-bold text-xs transition-all ${
                    activeCommand === 'R'
                      ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/40 scale-95'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:border-zinc-500'
                  }`}
                >
                  <ArrowRight className="w-6 h-6 mb-1" />
                  <span>RIGHT</span>
                  <span className="text-[9px] text-zinc-400">[D / →]</span>
                </button>

                {/* Row 3: Backward */}
                <div />
                <button
                  onClick={() => sendCmd('B')}
                  className={`h-20 rounded-xl border flex flex-col items-center justify-center font-mono font-bold text-xs transition-all ${
                    activeCommand === 'B'
                      ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/40 scale-95'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:border-zinc-500'
                  }`}
                >
                  <ArrowDown className="w-6 h-6 mb-1" />
                  <span>REVERSE</span>
                  <span className="text-[9px] text-zinc-400">[S / ↓]</span>
                </button>
                <div />
              </div>
            </div>
          </div>

          {/* Stepper Motor Speed Readouts */}
          <div className="pt-4 border-t border-zinc-800/80 grid grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">MOTOR 1 (STEP1: 18)</span>
              <span className="text-zinc-200 font-bold text-sm">
                {activeCommand === 'F' ? '+500' : activeCommand === 'B' ? '-500' : activeCommand === 'L' ? '-350' : activeCommand === 'R' ? '+350' : '0'} sps
              </span>
            </div>

            <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">MOTOR 2 (STEP2: 25)</span>
              <span className="text-zinc-200 font-bold text-sm">
                {activeCommand === 'F' ? '+500' : activeCommand === 'B' ? '-500' : activeCommand === 'L' ? '+350' : activeCommand === 'R' ? '-350' : '0'} sps
              </span>
            </div>

            <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">ENABLE PIN 23</span>
              <span className={`font-bold text-sm ${activeCommand === 'S' || t.flame_detected ? 'text-zinc-400' : 'text-emerald-400'}`}>
                {activeCommand === 'S' || t.flame_detected ? 'HIGH (OFF)' : 'LOW (DRIVE)'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Live Robot Sensor Stream over Bluetooth (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#0e1422] border border-zinc-800 rounded-xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
              <div className="flex items-center gap-2">
                <Bluetooth className="w-4 h-4 text-blue-400" />
                <h3 className="font-mono text-sm font-bold text-zinc-100">
                  BLUETOOTH SENSOR TELEMETRY
                </h3>
              </div>
              <span className="text-[10px] font-mono text-zinc-400">
                {btConnected ? btDeviceName : 'SIMULATED'}
              </span>
            </div>

            {/* Sensor Quick Tiles */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                <div className="flex items-center justify-between text-zinc-400 text-[10px]">
                  <span>MQ-7 GAS (GPIO 34)</span>
                  <Wind className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="text-xl font-black text-zinc-100 mt-1">
                  {t.flame_raw || 1420} <span className="text-xs font-normal text-zinc-400">ADC</span>
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  Threshold: 1900 ADC
                </div>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                <div className="flex items-center justify-between text-zinc-400 text-[10px]">
                  <span>FLAME SENSOR (GPIO 27)</span>
                  <Flame className="w-3.5 h-3.5 text-red-400" />
                </div>
                <div className={`text-sm font-bold mt-1.5 ${t.flame_detected ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                  {t.flame_detected ? '🔥 DETECTED' : 'CLEAR'}
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  Active LOW on GPIO 27
                </div>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                <div className="flex items-center justify-between text-zinc-400 text-[10px]">
                  <span>SOUND (GPIO 26)</span>
                  <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div className="text-xl font-black text-zinc-100 mt-1">
                  {t.sound_db ? `${t.sound_db.toFixed(1)} dB` : 'NORMAL'}
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  Acoustic Event
                </div>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                <div className="flex items-center justify-between text-zinc-400 text-[10px]">
                  <span>DHT22 (GPIO 4)</span>
                  <span className="text-zinc-400">3.3V</span>
                </div>
                <div className="text-base font-bold text-zinc-100 mt-1">
                  {t.temperature?.toFixed(1) || 24.5}°C / {t.humidity?.toFixed(1) || 48}%
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  Temp & Humidity
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800 text-[11px] font-mono text-zinc-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-zinc-400">
                <Compass className="w-3.5 h-3.5 text-red-400" />
                GPS NEO-7M:
              </span>
              <span>{telemetry?.gps?.lat.toFixed(5) || '37.77490'}, {telemetry?.gps?.lng.toFixed(5) || '-122.41940'}</span>
            </div>
          </div>

          {/* Bluetooth Console / Terminal Logs */}
          <div className="bg-[#0e1422] border border-zinc-800 rounded-xl p-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-zinc-200">
                <Terminal className="w-3.5 h-3.5 text-blue-400" />
                <span>BLUETOOTH SERIAL MONITOR</span>
              </div>
              <button
                onClick={() => setLogs([])}
                className="text-[10px] font-mono text-zinc-500 hover:text-zinc-300"
              >
                CLEAR
              </button>
            </div>

            <div className="mt-2 h-36 overflow-y-auto bg-black p-2.5 rounded-lg border border-zinc-800 text-[11px] font-mono text-zinc-300 space-y-1">
              {logs.length > 0 ? (
                logs.map((log, idx) => (
                  <div key={idx} className="leading-tight text-zinc-400">
                    {log}
                  </div>
                ))
              ) : (
                <div className="text-zinc-600 text-center py-8">
                  Ready. Commands and telemetry appear here.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Code & Pinout Guide Quick Card */}
      <div className="bg-[#0e1422] border border-zinc-800 rounded-xl p-5 shadow-xl flex items-center justify-between">
        <div>
          <h4 className="font-mono text-xs font-bold text-zinc-200 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-blue-400" />
            Looking for the updated ESP32 Arduino Bluetooth Code?
          </h4>
          <p className="font-mono text-[11px] text-zinc-400 mt-0.5">
            View and copy the full updated Arduino sketch with BluetoothSerial and BLE UART in the <strong>Docs & ESP32 Code</strong> tab.
          </p>
        </div>
        <button
          onClick={() => onSwitchTab('docs')}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold transition-colors shrink-0 shadow-md"
        >
          VIEW BLUETOOTH FIRMWARE
        </button>
      </div>
    </div>
  );
};
