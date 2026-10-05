"use client";

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const LunarMap = dynamic(() => import('./components/LunarMap'), { ssr: false });

export default function Home() {
  const [missions, setMissions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);

  useEffect(() => {
    fetch('/data/missions.json')
      .then(r => r.json())
      .then(d => {
        setMissions(d.missions);
        if (d.missions.length > 0) {
          setActiveId(d.missions[0].id);
        }
        setLoading(false);
      })
      .catch(e => {
        console.error("Failed to load missions", e);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#05070a] text-sky-400">
        <div className="animate-pulse font-mono tracking-widest text-sm flex items-center gap-3">
          <span className="w-4 h-4 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
          ESTABLISHING UPLINK...
        </div>
      </div>
    );
  }

  const activeMission = missions.find(m => m.id === activeId) || missions[0];
  if (!activeMission) return null;

  const m = activeMission.metrics || {};
  const eff = m.ops_efficiency ?? 0;
  
  const totalHours = 708.7; // ~29.53 days lunation
  const sunPct = ((m.sun_hours ?? 0) / totalHours) * 100;
  const earthPct = ((m.earth_hours ?? 0) / totalHours) * 100;
  const opsPct = ((m.ops_hours ?? 0) / totalHours) * 100;

  return (
    <div className="h-screen w-full flex flex-col selection:bg-sky-500/30 overflow-hidden bg-[#05070a] relative font-sans">
      
      {/* ── Background Map ── */}
      <div className="absolute inset-0 z-0">
        <LunarMap missions={missions} activeId={activeId} onSelect={setActiveId} />
      </div>

      {/* ── Top Navigation (Floating) ── */}
      <nav className="pointer-events-none absolute top-0 left-0 right-0 z-40 p-4 md:p-6 flex items-start justify-between">
        <div className="pointer-events-auto glass-panel px-4 py-3 md:px-5 md:py-3.5 rounded-xl md:rounded-2xl flex items-center gap-3 md:gap-4">
          <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399] animate-pulse" />
          <div>
            <h1 className="text-sm md:text-base font-semibold tracking-wide text-white font-heading leading-tight">Ops Window</h1>
            <p className="text-[9px] md:text-[10px] font-mono text-white/50 uppercase tracking-[0.2em] leading-tight mt-0.5">Selene Ref</p>
          </div>
        </div>

        {/* Mobile panel toggle */}
        <button 
          onClick={() => setPanelOpen(!panelOpen)}
          className="lg:hidden pointer-events-auto glass-panel px-4 py-3 rounded-xl text-xs font-mono font-medium text-white/80 active:scale-95 transition-transform"
        >
          {panelOpen ? 'HIDE TELEMETRY' : 'SHOW TELEMETRY'}
        </button>
      </nav>

      {/* ── Main UI Layer (Pointer Events None so map is clickable) ── */}
      <div className="absolute inset-0 z-30 pointer-events-none flex flex-col lg:flex-row justify-end lg:justify-between items-end p-4 md:p-6 pt-24 lg:pt-24 gap-6">
        
        {/* Bottom Mission Selector (Desktop only, or hidden on mobile to save space) */}
        <div className="hidden lg:flex pointer-events-auto glass-panel p-2 rounded-2xl max-w-[600px] overflow-x-auto scrollbar-none gap-2">
          {missions.filter(x => ['apollo-11', 'surveyor-1', 'im-1', 'change-4'].includes(x.id)).map(mission => {
            const isActive = activeId === mission.id;
            const efficiency = (mission.metrics?.ops_efficiency ?? 0) * 100;
            return (
              <button 
                key={mission.id}
                onClick={() => setActiveId(mission.id)}
                className={`flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive ? 'bg-white/10 shadow-inner ring-1 ring-white/20' : 'hover:bg-white/5'}`}
              >
                <div className={`text-xs font-mono font-medium px-1.5 py-0.5 rounded border ${isActive ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' : 'bg-white/5 text-white/40 border-white/10'}`}>
                  {efficiency.toFixed(0)}%
                </div>
                <div className="text-left">
                  <div className={`text-sm font-medium ${isActive ? 'text-white' : 'text-white/60'}`}>{mission.name}</div>
                </div>
              </button>
            )
          })}
          <button className="flex-shrink-0 px-4 py-3 rounded-xl text-xs font-mono text-white/40 hover:text-white/80 transition-colors flex items-center">
            + {missions.length - 4} MORE
          </button>
        </div>

        {/* Telemetry Sidebar */}
        <aside className={`pointer-events-auto w-full lg:w-[420px] max-w-[500px] glass-panel rounded-2xl md:rounded-3xl flex flex-col transition-all duration-500 ease-in-out transform origin-bottom lg:origin-right
          ${panelOpen ? 'opacity-100 scale-100 translate-y-0 lg:translate-x-0' : 'opacity-0 scale-95 translate-y-8 lg:translate-y-0 lg:translate-x-8 pointer-events-none'}`}
          style={{ maxHeight: 'calc(100vh - 120px)' }}
        >
          <div className="p-5 md:p-8 overflow-y-auto scrollbar-none flex-1">
            
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-6 md:mb-8">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className={`px-2 py-1 text-[9px] font-mono font-bold uppercase tracking-widest rounded border ${activeMission.status === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                    {activeMission.status}
                  </span>
                  <span className="text-[10px] font-mono text-white/40 tracking-wider">
                    {activeMission.lat_deg.toFixed(4)}°, {activeMission.lon_east_deg.toFixed(4)}°
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-heading font-semibold text-white tracking-tight leading-tight">{activeMission.name}</h2>
                <p className="text-xs md:text-sm text-slate-400 mt-1.5">{activeMission.site_name}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-1">Ops Efficiency</div>
                <div className="text-4xl md:text-5xl font-mono font-medium text-white tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                  {(eff * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Visualizer */}
            <div className="space-y-5 md:space-y-6 mb-8 md:mb-10">
              <div className="group">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-xs font-medium text-slate-300 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" /> Solar Power
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 group-hover:text-amber-400 transition-colors">{m.sun_hours ?? 'n/a'} hrs</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-black/40 overflow-hidden">
                  <div className="h-full bg-amber-400 transition-all duration-1000 ease-out" style={{ width: `${Math.min(100, sunPct)}%` }} />
                </div>
              </div>

              <div className="group">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-xs font-medium text-slate-300 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa]" /> Earth Link
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 group-hover:text-blue-400 transition-colors">{m.earth_hours ?? 'n/a'} hrs</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-black/40 overflow-hidden">
                  <div className="h-full bg-blue-400 transition-all duration-1000 ease-out" style={{ width: `${Math.min(100, earthPct)}%` }} />
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" /> 
                    Ops Window (Overlap)
                  </span>
                  <span className="text-xs font-mono font-medium text-emerald-400">{m.ops_hours ?? 'n/a'} hrs</span>
                </div>
                <div className="w-full h-3 rounded-full bg-black/50 p-[1px] border border-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399] transition-all duration-1000 ease-out" style={{ width: `${Math.min(100, opsPct)}%` }} />
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <MetricBox label="Landing Date" value={activeMission.landing_utc} />
              <MetricBox label="Duration" value={activeMission.ops_duration} />
              <MetricBox label="End Reason" value={activeMission.end_reason} />
              <MetricBox label="Confidence" value={<span className="capitalize">{activeMission.confidence}</span>} />
            </div>

            {activeMission.payloads && activeMission.payloads.length > 0 && (
              <div className="mt-3 md:mt-4 glass-panel-light p-3 md:p-4 rounded-xl md:rounded-2xl">
                <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-1.5 block">Payloads</span>
                <span className="text-xs text-slate-300 leading-relaxed">{activeMission.payloads.join(', ')}</span>
              </div>
            )}
          </div>
        </aside>

      </div>
    </div>
  );
}

function MetricBox({ label, value }) {
  return (
    <div className="glass-panel-light p-3 md:p-4 rounded-xl flex flex-col justify-center">
      <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-1.5 block truncate">{label}</span>
      <span className="text-xs font-medium text-white truncate">{value}</span>
    </div>
  );
}
