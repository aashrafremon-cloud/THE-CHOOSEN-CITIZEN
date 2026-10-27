import React, { useState } from 'react';
import { 
  LineChart, 
  Download, 
  Filter, 
  Search, 
  Flame, 
  Wind, 
  Thermometer, 
  ShieldAlert, 
  Calendar, 
  Clock, 
  RefreshCw,
  Database
} from 'lucide-react';
import { TelemetryData, AlertEvent } from '../types';

interface HistoryAnalyticsViewProps {
  history: TelemetryData[];
  events: AlertEvent[];
  onRefreshHistory: () => void;
}

export const HistoryAnalyticsView: React.FC<HistoryAnalyticsViewProps> = ({
  history,
  events,
  onRefreshHistory,
}) => {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeMetric, setActiveMetric] = useState<'temp' | 'co' | 'hum'>('temp');

  // Compute analytics summary
  const totalPoints = history.length;
  const temps = history.map((h) => h.temperature);
  const cos = history.map((h) => h.mq7_co_ppm);
  const hums = history.map((h) => h.humidity);

  const peakTemp = temps.length > 0 ? Math.max(...temps) : 25.0;
  const peakCo = cos.length > 0 ? Math.max(...cos) : 15.0;
  const avgHum = hums.length > 0 ? (hums.reduce((a, b) => a + b, 0) / hums.length) : 50.0;
  const criticalEventCount = events.filter((e) => e.severity === 'CRITICAL').length;

  // Filter events
  const filteredEvents = events.filter((e) => {
    const matchesSeverity = selectedSeverity === 'ALL' || e.severity === selectedSeverity;
    const matchesQuery = !searchQuery || 
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.source.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSeverity && matchesQuery;
  });

  // SVG Chart path calculation
  const chartPoints = history.slice(-60);
  const getPointsSvg = (metricKey: 'temperature' | 'mq7_co_ppm' | 'humidity', yMax: number, yMin: number = 0) => {
    if (chartPoints.length < 2) return '';
    const width = 800;
    const height = 220;
    const stepX = width / (chartPoints.length - 1);

    return chartPoints
      .map((p, i) => {
        const val = p[metricKey] as number;
        const normalizedY = height - ((val - yMin) / (yMax - yMin || 1)) * (height - 30) - 15;
        return `${i * stepX},${Math.max(10, Math.min(height - 10, normalizedY))}`;
      })
      .join(' ');
  };

  const handleDownloadCsv = () => {
    window.location.href = '/api/export/csv';
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Export Actions */}
      <div className="bg-[#0e1422] border border-zinc-800 rounded-xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="font-mono text-sm font-bold text-zinc-100 flex items-center gap-2">
            <Database className="w-4 h-4 text-red-400" />
            HISTORICAL TELEMETRY & INCIDENT AUDIT
          </h2>
          <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
            Query time-series sensor records, analyze trends, and export complete audit logs to CSV
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onRefreshHistory}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono font-medium border border-zinc-700 flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>REFRESH DATA</span>
          </button>

          <button
            onClick={handleDownloadCsv}
            className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-md shadow-red-600/30 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXPORT CSV</span>
          </button>
        </div>
      </div>

      {/* Analytics Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#0e1422] border border-zinc-800">
          <div className="text-[10px] font-mono text-zinc-400 uppercase">Peak Temperature</div>
          <div className="text-2xl font-black font-mono mt-1 text-zinc-100 flex items-baseline gap-1">
            <span className={peakTemp > 60 ? 'text-red-400' : peakTemp > 45 ? 'text-amber-400' : 'text-zinc-100'}>
              {peakTemp.toFixed(1)}°C
            </span>
          </div>
          <div className="text-[10px] font-mono text-zinc-400 mt-1">DHT22 Thermal Peak</div>
        </div>

        <div className="p-4 rounded-xl bg-[#0e1422] border border-zinc-800">
          <div className="text-[10px] font-mono text-zinc-400 uppercase">Peak Carbon Monoxide</div>
          <div className="text-2xl font-black font-mono mt-1 text-zinc-100 flex items-baseline gap-1">
            <span className={peakCo > 150 ? 'text-red-400' : peakCo > 50 ? 'text-amber-400' : 'text-zinc-100'}>
              {peakCo.toFixed(1)}
            </span>
            <span className="text-xs text-zinc-400">PPM</span>
          </div>
          <div className="text-[10px] font-mono text-zinc-400 mt-1">MQ-7 Toxic Gas Surge</div>
        </div>

        <div className="p-4 rounded-xl bg-[#0e1422] border border-zinc-800">
          <div className="text-[10px] font-mono text-zinc-400 uppercase">Critical Hazard Triggers</div>
          <div className="text-2xl font-black font-mono mt-1 text-red-400">
            {criticalEventCount}
          </div>
          <div className="text-[10px] font-mono text-zinc-400 mt-1">Flame / Overheat / High CO</div>
        </div>

        <div className="p-4 rounded-xl bg-[#0e1422] border border-zinc-800">
          <div className="text-[10px] font-mono text-zinc-400 uppercase">Logged Telemetry Points</div>
          <div className="text-2xl font-black font-mono mt-1 text-emerald-400">
            {totalPoints}
          </div>
          <div className="text-[10px] font-mono text-zinc-400 mt-1">SQLite Ring Store</div>
        </div>
      </div>

      {/* Historical Telemetry Chart */}
      <div className="bg-[#0e1422] border border-zinc-800 rounded-xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-zinc-800/80 gap-3">
          <div>
            <h3 className="font-mono text-sm font-bold text-zinc-100">TIME-SERIES TELEMETRY GRAPH</h3>
            <p className="text-[10px] text-zinc-400 font-mono">Telemetry trajectory across active logging session</p>
          </div>

          <div className="flex items-center gap-2 bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs font-mono">
            <button
              onClick={() => setActiveMetric('temp')}
              className={`px-3 py-1 rounded transition-colors ${
                activeMetric === 'temp' ? 'bg-red-500/20 text-red-400 font-bold border border-red-500/40' : 'text-zinc-400'
              }`}
            >
              TEMPERATURE (°C)
            </button>
            <button
              onClick={() => setActiveMetric('co')}
              className={`px-3 py-1 rounded transition-colors ${
                activeMetric === 'co' ? 'bg-amber-500/20 text-amber-400 font-bold border border-amber-500/40' : 'text-zinc-400'
              }`}
            >
              CO GAS (PPM)
            </button>
            <button
              onClick={() => setActiveMetric('hum')}
              className={`px-3 py-1 rounded transition-colors ${
                activeMetric === 'hum' ? 'bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/40' : 'text-zinc-400'
              }`}
            >
              HUMIDITY (%)
            </button>
          </div>
        </div>

        {/* SVG Curve */}
        <div className="py-4">
          {chartPoints.length > 1 ? (
            <div className="w-full h-56 bg-[#090d16] rounded-lg border border-zinc-800 p-3 relative flex flex-col justify-between">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 800 220" preserveAspectRatio="none">
                {activeMetric === 'temp' && (
                  <polyline
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={getPointsSvg('temperature', peakTemp + 10, 0)}
                  />
                )}
                {activeMetric === 'co' && (
                  <polyline
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={getPointsSvg('mq7_co_ppm', peakCo + 20, 0)}
                  />
                )}
                {activeMetric === 'hum' && (
                  <polyline
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={getPointsSvg('humidity', 100, 0)}
                  />
                )}
              </svg>

              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-2 border-t border-zinc-800/60 z-10">
                <span>OLDEST: {new Date(chartPoints[0].timestamp).toLocaleTimeString()}</span>
                <span>METRIC: {activeMetric.toUpperCase()}</span>
                <span>LATEST: {new Date(chartPoints[chartPoints.length - 1].timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          ) : (
            <div className="h-44 flex items-center justify-center font-mono text-xs text-zinc-400">
              Gathering historical sensor points...
            </div>
          )}
        </div>
      </div>

      {/* Filterable Incident Events Table */}
      <div className="bg-[#0e1422] border border-zinc-800 rounded-xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-zinc-800/80 gap-3">
          <h3 className="font-mono text-sm font-bold text-zinc-100 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-zinc-400" />
            INCIDENT LOG AUDIT TRAIL
          </h3>

          {/* Severity & Search Filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            {/* Search input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 focus:outline-hidden focus:border-red-500"
              />
            </div>

            {/* Severity Pill Selector */}
            <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
              {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSelectedSeverity(sev)}
                  className={`px-2 py-1 rounded transition-colors ${
                    selectedSeverity === sev ? 'bg-zinc-700 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-[10px] text-zinc-400 uppercase">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3">Event Title</th>
                <th className="py-2.5 px-3">Source Node</th>
                <th className="py-2.5 px-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredEvents.length > 0 ? (
                filteredEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="py-2.5 px-3 text-zinc-400 whitespace-nowrap">
                      {new Date(evt.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        evt.severity === 'CRITICAL'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                          : evt.severity === 'WARNING'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {evt.severity}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-zinc-200">
                      {evt.title}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400">
                      {evt.source}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400 max-w-md truncate">
                      {evt.description}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-400 font-mono">
                    No matching events found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
