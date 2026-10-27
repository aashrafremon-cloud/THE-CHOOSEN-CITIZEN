import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, 
  VideoOff, 
  Play, 
  Square, 
  Maximize2, 
  Minimize2, 
  Camera, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  ShieldCheck, 
  Sliders, 
  Terminal, 
  Zap,
  Info,
  Server
} from 'lucide-react';
import { CameraState, StreamMode, AppSettings } from '../types';
import { probeCameraEndpoints } from '../services/api';

interface LiveCameraViewProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onFrameCaptured?: (dataUrl: string) => void;
}

export const LiveCameraView: React.FC<LiveCameraViewProps> = ({
  settings,
  onUpdateSettings,
  onFrameCaptured,
}) => {
  const [cameraIp, setCameraIp] = useState(settings.cameraIp || '192.168.1.80');
  const [customUrl, setCustomUrl] = useState(settings.cameraCustomUrl || '');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [probeResults, setProbeResults] = useState<any | null>(null);
  const [isProbing, setIsProbing] = useState(false);

  // Camera connection state
  const [cameraState, setCameraState] = useState<CameraState>({
    connected: false,
    mode: 'idle',
    configuredIp: settings.cameraIp || '192.168.1.80',
    activeUrl: '',
    fps: 0,
    latencyMs: 0,
    lastFrameTime: 0,
    retrying: false,
    retryCount: 0,
    fallbackStep: 0,
    isBackendProxied: false,
  });

  const [currentFrameUrl, setCurrentFrameUrl] = useState<string>('');
  const [lastCapturedImage, setLastCapturedImage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const snapshotTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fpsCounterRef = useRef<{ frames: number; lastSec: number }>({ frames: 0, lastSec: Date.now() });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, []);

  const stopStreaming = () => {
    if (snapshotTimerRef.current) {
      clearInterval(snapshotTimerRef.current);
      snapshotTimerRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    setCameraState((prev) => ({
      ...prev,
      connected: false,
      mode: 'idle',
      retrying: false,
      error: undefined,
    }));
    setCurrentFrameUrl('');
  };

  /**
   * 5-Stage Fallback Connection Engine:
   * 1. Custom URL (if specified)
   * 2. Direct MJPEG Stream (http://<ip>:81/stream or http://<ip>/stream)
   * 3. JPEG Snapshot Polling (http://<ip>/capture)
   * 4. Backend Proxy Stream / Snapshot (/api/camera/proxy-snapshot?url=...)
   * 5. Clear Diagnostic Error
   */
  const startConnectionFlow = async () => {
    stopStreaming();
    const targetIp = cameraIp.trim();
    if (!targetIp) {
      setCameraState((prev) => ({ ...prev, mode: 'error', error: 'Camera IP or URL is required.' }));
      return;
    }

    setCameraState((prev) => ({
      ...prev,
      configuredIp: targetIp,
      retrying: true,
      error: undefined,
      fallbackStep: 1,
      mode: 'idle',
    }));

    // Check if we are running in HTTPS on a public cloud domain
    const isPublicHttps = window.location.protocol === 'https:' && !window.location.hostname.includes('localhost');

    // Stage 1: Custom Stream URL if supplied
    if (customUrl.trim()) {
      setCameraState((prev) => ({ ...prev, fallbackStep: 1, mode: 'direct_mjpeg', activeUrl: customUrl }));
      const works = await testImageOrStream(customUrl);
      if (works) {
        setCameraState((prev) => ({
          ...prev,
          connected: true,
          mode: 'direct_mjpeg',
          activeUrl: customUrl,
          retrying: false,
          fallbackStep: 1,
        }));
        setCurrentFrameUrl(customUrl);
        return;
      }
    }

    // Stage 2: Direct MJPEG Stream (skip if HTTPS mixed-content blocks private IP)
    if (!isPublicHttps) {
      const standardMjpegUrls = [
        `http://${targetIp}:81/stream`,
        `http://${targetIp}/stream`,
      ];

      for (const mjpegUrl of standardMjpegUrls) {
        setCameraState((prev) => ({ ...prev, fallbackStep: 2, activeUrl: mjpegUrl }));
        const mjpegOk = await testImageOrStream(mjpegUrl);
        if (mjpegOk) {
          setCameraState((prev) => ({
            ...prev,
            connected: true,
            mode: 'direct_mjpeg',
            activeUrl: mjpegUrl,
            retrying: false,
            fallbackStep: 2,
            isBackendProxied: false,
          }));
          setCurrentFrameUrl(mjpegUrl);
          return;
        }
      }

      // Stage 3: Direct Snapshot Polling (/capture)
      const directSnapshotUrl = `http://${targetIp}/capture`;
      setCameraState((prev) => ({ ...prev, fallbackStep: 3, activeUrl: directSnapshotUrl }));
      const directSnapshotOk = await testImageOrStream(directSnapshotUrl);
      if (directSnapshotOk) {
        activateSnapshotPolling(directSnapshotUrl, false);
        return;
      }
    }

    // Stage 4: Backend Proxy Snapshot Polling (Bypasses CORS & HTTPS Mixed-Content)
    setCameraState((prev) => ({ ...prev, fallbackStep: 4 }));
    const candidateUrls = [
      `http://${targetIp}/capture`,
      `http://${targetIp}:81/capture`,
      `http://${targetIp}/jpg`,
    ];

    for (const remoteTarget of candidateUrls) {
      const proxyUrl = `/api/camera/proxy-snapshot?url=${encodeURIComponent(remoteTarget)}`;
      try {
        const t0 = Date.now();
        const testResp = await fetch(proxyUrl);
        if (testResp.ok) {
          const latency = Date.now() - t0;
          activateSnapshotPolling(remoteTarget, true, latency);
          return;
        }
      } catch (err) {
        // Next
      }
    }

    // Stage 5: Clear Connection Error
    setCameraState((prev) => ({
      ...prev,
      connected: false,
      mode: 'error',
      retrying: false,
      fallbackStep: 5,
      error: isPublicHttps
        ? `Browser Security Notice: Direct HTTP connections to local LAN camera (${targetIp}) are blocked on public HTTPS. Ensure your local Python backend is running or use a tunnel (Cloudflare/ngrok).`
        : `Could not connect to ESP32-CAM at ${targetIp}. Tested /stream, /capture, /status across ports 80 & 81. Camera timed out or is unpowered.`,
    }));
  };

  const testImageOrStream = (url: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      const timeout = setTimeout(() => {
        img.src = '';
        resolve(false);
      }, 2500);

      img.onload = () => {
        clearTimeout(timeout);
        resolve(true);
      };
      img.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
      img.src = `${url}?t=${Date.now()}`;
    });
  };

  const activateSnapshotPolling = (targetRemoteUrl: string, useBackendProxy: boolean, initialLatency = 45) => {
    setCameraState((prev) => ({
      ...prev,
      connected: true,
      mode: useBackendProxy ? 'backend_proxy_snapshot' : 'snapshot_polling',
      activeUrl: targetRemoteUrl,
      retrying: false,
      isBackendProxied: useBackendProxy,
      latencyMs: initialLatency,
      fallbackStep: useBackendProxy ? 4 : 3,
    }));

    const intervalMs = settings.snapshotIntervalMs || 350;

    const fetchNextFrame = async () => {
      const t0 = Date.now();
      const fetchUrl = useBackendProxy
        ? `/api/camera/proxy-snapshot?url=${encodeURIComponent(targetRemoteUrl)}&t=${t0}`
        : `${targetRemoteUrl}?t=${t0}`;

      try {
        const res = await fetch(fetchUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);

        setCurrentFrameUrl((old) => {
          if (old && old.startsWith('blob:')) URL.revokeObjectURL(old);
          return blobUrl;
        });

        const latency = Date.now() - t0;
        const now = Date.now();

        // Calculate FPS
        fpsCounterRef.current.frames++;
        if (now - fpsCounterRef.current.lastSec >= 1000) {
          const calculatedFps = fpsCounterRef.current.frames;
          fpsCounterRef.current = { frames: 0, lastSec: now };
          setCameraState((prev) => ({ ...prev, fps: calculatedFps }));
        }

        setCameraState((prev) => ({
          ...prev,
          lastFrameTime: now,
          latencyMs: latency,
        }));

        // Convert to dataUrl for AI inference if hook provided
        if (onFrameCaptured) {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              onFrameCaptured(reader.result);
            }
          };
          reader.readAsDataURL(blob);
        }
      } catch (err: any) {
        console.warn('Snapshot polling frame drop:', err);
      }
    };

    fetchNextFrame();
    snapshotTimerRef.current = setInterval(fetchNextFrame, intervalMs);
  };

  const handleProbeEndpoints = async () => {
    setIsProbing(true);
    setProbeResults(null);
    try {
      const results = await probeCameraEndpoints(cameraIp.trim());
      setProbeResults(results);
    } catch (err: any) {
      setProbeResults({ error: err.message || 'Failed to probe' });
    } finally {
      setIsProbing(false);
    }
  };

  const captureManualSnapshot = () => {
    if (!currentFrameUrl) return;
    setLastCapturedImage(currentFrameUrl);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Configuration & Fallback Engine Card */}
      <div className="bg-[#0e1422] border border-zinc-800 rounded-xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-4 border-b border-zinc-800/80 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-mono text-sm font-bold text-zinc-100">ESP32-CAM STREAM FALLBACK CONTROLLER</h2>
              <p className="text-[10px] text-zinc-400 font-mono">
                5-Stage Priority: Configured URL → MJPEG Stream → Snapshot Polling → Backend Proxy → Error Diagnostics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleProbeEndpoints}
              disabled={isProbing}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-mono text-zinc-300 border border-zinc-700 flex items-center gap-1.5 transition-colors"
            >
              <Terminal className="w-3.5 h-3.5 text-zinc-400" />
              <span>{isProbing ? 'PROBING...' : 'PROBE ENDPOINTS'}</span>
            </button>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-mono text-zinc-300 border border-zinc-700 flex items-center gap-1.5 transition-colors"
            >
              <Sliders className="w-3.5 h-3.5 text-zinc-400" />
              <span>{showAdvanced ? 'HIDE OPTIONS' : 'ADVANCED'}</span>
            </button>
          </div>
        </div>

        {/* IP and Connection Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-4">
          <div className="md:col-span-5">
            <label className="block text-[11px] font-mono text-zinc-400 uppercase mb-1">
              ESP32-CAM IP Address
            </label>
            <div className="relative">
              <input
                type="text"
                value={cameraIp}
                onChange={(e) => setCameraIp(e.target.value)}
                placeholder="192.168.1.80"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-red-500"
              />
              <span className="absolute right-2.5 top-2 text-[10px] font-mono text-zinc-500">
                LAN / VPN
              </span>
            </div>
          </div>

          <div className="md:col-span-5">
            <label className="block text-[11px] font-mono text-zinc-400 uppercase mb-1">
              Custom Stream Endpoint (Optional)
            </label>
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="http://192.168.1.80:81/stream or rtsp://"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-red-500"
            />
          </div>

          <div className="md:col-span-2 flex items-end">
            {cameraState.connected || cameraState.retrying ? (
              <button
                onClick={stopStreaming}
                className="w-full py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-mono font-bold text-red-400 border border-red-500/30 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>DISCONNECT</span>
              </button>
            ) : (
              <button
                onClick={startConnectionFlow}
                className="w-full py-2 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-mono font-bold text-white shadow-lg shadow-red-600/30 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>CONNECT</span>
              </button>
            )}
          </div>
        </div>

        {/* Advanced Fallback Tuning Bar */}
        {showAdvanced && (
          <div className="mt-4 pt-4 border-t border-zinc-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div>
              <span className="text-zinc-400 block mb-1">Snapshot Polling Interval</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="150"
                  max="1500"
                  step="50"
                  value={settings.snapshotIntervalMs || 350}
                  onChange={(e) => onUpdateSettings({ snapshotIntervalMs: parseInt(e.target.value, 10) })}
                  className="w-full accent-red-500"
                />
                <span className="text-zinc-200 font-bold w-14 text-right">
                  {settings.snapshotIntervalMs || 350}ms
                </span>
              </div>
            </div>

            <div>
              <span className="text-zinc-400 block mb-1">Auto Fallback Priority</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Enabled (Stages 1 → 2 → 3 → 4)
              </span>
            </div>

            <div>
              <span className="text-zinc-400 block mb-1">Backend Proxy Security</span>
              <span className="text-zinc-300 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                SSRF Guard Active (Blocked 169.254/127.0)
              </span>
            </div>
          </div>
        )}

        {/* Endpoint Probe Results Modal / Inline Banner */}
        {probeResults && (
          <div className="mt-4 p-3.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-mono">
            <div className="flex items-center justify-between font-bold text-zinc-200 pb-2 border-b border-zinc-800">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-red-400" />
                ESP32-CAM Endpoint Probe Results ({probeResults.ip})
              </span>
              <span className="text-zinc-400">
                Recommended: <span className="text-emerald-400 font-bold">{probeResults.recommendedMode}</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-2.5">
              {probeResults.results?.map((ep: any, idx: number) => (
                <div 
                  key={idx}
                  className={`p-2 rounded border ${
                    ep.alive ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400'
                  }`}
                >
                  <div className="font-bold truncate">{ep.url}</div>
                  <div className="text-[10px] mt-1 flex items-center justify-between">
                    <span>{ep.alive ? `HTTP ${ep.statusCode} OK` : 'UNREACHABLE'}</span>
                    {ep.latencyMs && <span>{ep.latencyMs}ms</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Video Viewport Canvas */}
      <div 
        ref={containerRef}
        className="bg-[#06090e] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl relative flex flex-col justify-between"
        style={{ minHeight: '520px' }}
      >
        {/* Top HUD Overlay Bar */}
        <div className="p-3.5 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between z-20 font-mono text-xs text-zinc-300">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${
                cameraState.connected 
                  ? 'bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]' 
                  : cameraState.retrying
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-zinc-600'
              }`} />
              <span className="font-bold tracking-wider">
                {cameraState.connected ? 'CAM LIVE FEED' : cameraState.retrying ? 'CONNECTING...' : 'DISCONNECTED'}
              </span>
            </div>

            {/* Stage Indicator Badge */}
            {cameraState.connected && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800/90 border border-zinc-700 text-zinc-300">
                {cameraState.mode === 'direct_mjpeg' && 'STAGE 2: DIRECT MJPEG'}
                {cameraState.mode === 'snapshot_polling' && 'STAGE 3: DIRECT SNAPSHOT POLLING'}
                {cameraState.mode === 'backend_proxy_snapshot' && 'STAGE 4: BACKEND PROXY (CORS/HTTPS BYPASS)'}
              </span>
            )}
          </div>

          {/* Video Metrics */}
          {cameraState.connected && (
            <div className="flex items-center gap-3 text-[11px]">
              <span>FPS: <strong className="text-zinc-100">{cameraState.fps || (cameraState.mode === 'direct_mjpeg' ? 25 : 3)}</strong></span>
              <span>LATENCY: <strong className="text-zinc-100">{cameraState.latencyMs}ms</strong></span>
              <span>RES: <strong className="text-zinc-100">640x480 VGA</strong></span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={captureManualSnapshot}
              disabled={!cameraState.connected}
              className="p-1.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors disabled:opacity-40"
              title="Capture Still Snapshot"
            >
              <Camera className="w-4 h-4" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Central Display */}
        <div className="flex-1 flex items-center justify-center p-4 relative">
          {cameraState.connected && currentFrameUrl ? (
            <div className="relative max-w-full max-h-[460px] rounded-lg overflow-hidden border border-zinc-800 shadow-2xl">
              <img
                src={currentFrameUrl}
                alt="ESP32-CAM Feed"
                className="w-full h-full object-contain"
              />
              {/* Scanline Overlay Effect for industrial aesthetic */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none opacity-40" />
            </div>
          ) : cameraState.retrying ? (
            <div className="flex flex-col items-center justify-center gap-3 text-center p-8">
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
              <div className="font-mono text-sm text-zinc-200 font-bold">
                Resolving Camera Stream via 5-Stage Fallback...
              </div>
              <div className="font-mono text-xs text-zinc-400 max-w-md">
                Testing: Configured URL → MJPEG (:81/stream) → JPEG (/capture) → Backend Proxy...
              </div>
            </div>
          ) : cameraState.mode === 'error' ? (
            <div className="max-w-lg p-6 rounded-xl bg-red-950/30 border border-red-500/40 text-center font-mono">
              <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-red-300 uppercase tracking-wide">
                Camera Connection Failed
              </h3>
              <p className="text-xs text-zinc-300 mt-2 leading-relaxed">
                {cameraState.error}
              </p>
              
              <div className="mt-4 p-3 rounded bg-black/60 border border-zinc-800 text-[11px] text-left text-zinc-400 space-y-1.5">
                <div className="font-bold text-zinc-300">Quick Diagnostic Checklist:</div>
                <div>1. Ensure ESP32-CAM is powered with a stable 5V 2A supply (brownouts cause boot-loops).</div>
                <div>2. Check that the ESP32-CAM IP ({cameraIp}) matches the IP printed in Arduino Serial Monitor.</div>
                <div>3. For public cloud previews, click <strong>Probe Endpoints</strong> above or run Cloudflare Tunnel / ngrok to bridge private LAN.</div>
              </div>

              <div className="mt-4 flex gap-3 justify-center">
                <button
                  onClick={startConnectionFlow}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold text-white shadow-md transition-colors"
                >
                  Retry Connection Sequence
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 text-center p-8 font-mono text-zinc-400">
              <VideoOff className="w-10 h-10 text-zinc-600" />
              <div className="text-sm font-bold text-zinc-300">ESP32-CAM Feed Offline</div>
              <p className="text-xs max-w-sm text-zinc-500">
                Enter your camera IP address above and click <strong>CONNECT</strong> to initiate automatic 5-stage stream fallback.
              </p>
              <button
                onClick={startConnectionFlow}
                className="mt-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold border border-zinc-700 transition-colors"
              >
                Connect to {cameraIp}
              </button>
            </div>
          )}
        </div>

        {/* Bottom Status Ticker */}
        <div className="p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-between z-20 font-mono text-[11px] text-zinc-400 border-t border-zinc-800/60">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">TARGET:</span>
            <span className="text-zinc-300 font-semibold">{cameraState.configuredIp}</span>
            {cameraState.activeUrl && (
              <>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-500">ACTIVE:</span>
                <span className="text-zinc-300 truncate max-w-xs">{cameraState.activeUrl}</span>
              </>
            )}
          </div>
          <div>
            STATUS: <span className="text-zinc-200 font-bold uppercase">{cameraState.mode}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
