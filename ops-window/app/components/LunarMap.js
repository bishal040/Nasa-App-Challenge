"use client";

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const lon180 = lon => lon > 180 ? lon - 360 : lon;
const getColor = e => `hsl(${Math.round(120 * Math.max(0, Math.min(1, e)))}, 70%, ${e > 0.5 ? 45 : 50}%)`;

export default function LunarMap({ missions, activeId, onSelect }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const BOUNDS = L.latLngBounds([[-90, -180], [90, 180]]);

    const map = L.map(mapRef.current, {
      crs: L.CRS.EPSG4326,
      center: [0, 0],
      zoom: 1,
      minZoom: 1,      // Prevent zooming out too far (which causes blanks)
      maxZoom: 6,      // Max zoom available from NASA tiles
      zoomSnap: 0.5,
      zoomDelta: 0.5,
      maxBounds: BOUNDS.pad(0.05), // Prevent panning too far off the map
      maxBoundsViscosity: 1.0,
      attributionControl: true,
      zoomControl: true,
    });

    map.fitBounds(BOUNDS);

    // NASA Moon Trek WMTS tiles
    const TILE_URL = 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg';
    
    L.tileLayer(TILE_URL, {
      tileSize: 256,
      noWrap: true,       // Don't repeat the moon horizontally
      bounds: BOUNDS,     // Tell leaflet exactly where the tiles exist
      minZoom: 1,
      maxZoom: 6,
      attribution: 'NASA/JPL Moon Trek'
    }).addTo(map);

    map.zoomControl.setPosition('bottomright');
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Sync markers when missions or selection changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !missions || missions.length === 0) return;

    // Clear old markers
    Object.values(markersRef.current).forEach(({ marker }) => map.removeLayer(marker));
    markersRef.current = {};

    missions.forEach(mission => {
      const eff = mission.metrics?.ops_efficiency ?? 0;
      const lat = mission.lat_deg;
      const lng = lon180(mission.lon_east_deg);
      const isSelected = mission.id === activeId;
      const color = getColor(eff);

      // Add glow for selected marker
      if (isSelected) {
        const glow = L.circleMarker([lat, lng], {
          radius: 16,
          color: color,
          weight: 1,
          fillColor: color,
          fillOpacity: 0.12,
          interactive: false,
          className: 'pulse-ring'
        }).addTo(map);
        markersRef.current[mission.id + '_glow'] = { marker: glow };
      }

      const marker = L.circleMarker([lat, lng], {
        radius: isSelected ? 8 : 5,
        color: isSelected ? '#ffffff' : 'rgba(5,7,10,0.8)',
        weight: isSelected ? 2 : 1.5,
        fillColor: color,
        fillOpacity: 0.95,
      }).addTo(map);

      marker.bindTooltip(
        `<div style="font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:13px;margin-bottom:3px;color:#fff">${mission.name}</div>
         <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:rgba(255,255,255,0.6)">${mission.site_name}</div>
         <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:${color};margin-top:4px;font-weight:600">${(eff * 100).toFixed(1)}% ops window</div>`,
        { direction: 'top', offset: [0, -10], className: 'moon-tooltip' }
      );

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (onSelect) onSelect(mission.id);
      });

      markersRef.current[mission.id] = { marker, data: mission };
    });
  }, [missions, activeId, onSelect]);

  return (
    <>
      <style jsx global>{`
        .leaflet-container {
          background: #05070a !important;
        }
        .leaflet-control-zoom {
          border: none !important;
          border-radius: 10px !important;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0,0,0,0.6) !important;
        }
        .leaflet-control-zoom a {
          background: rgba(8, 12, 17, 0.9) !important;
          backdrop-filter: blur(16px);
          color: rgba(255, 255, 255, 0.6) !important;
          border-color: rgba(255, 255, 255, 0.06) !important;
          width: 34px !important;
          height: 34px !important;
          line-height: 34px !important;
          font-size: 15px !important;
          font-weight: 400;
          transition: all 0.2s ease;
        }
        .leaflet-control-zoom a:hover {
          background: rgba(14, 20, 30, 0.95) !important;
          color: #fff !important;
        }
        .leaflet-control-attribution {
          background: rgba(5, 7, 10, 0.75) !important;
          backdrop-filter: blur(8px);
          color: rgba(255,255,255,0.3) !important;
          font-size: 9px !important;
          font-family: 'JetBrains Mono', monospace !important;
          border: none !important;
          letter-spacing: 0.02em;
        }
        .leaflet-control-attribution a { color: rgba(255,255,255,0.4) !important; }
        .moon-tooltip {
          background: rgba(5, 7, 10, 0.94) !important;
          backdrop-filter: blur(20px) saturate(150%);
          border: 1px solid rgba(255,255,255,0.08) !important;
          border-radius: 12px !important;
          padding: 10px 14px !important;
          box-shadow: 0 12px 40px rgba(0,0,0,0.7) !important;
          color: #f1f5f9 !important;
        }
        .moon-tooltip::before {
          border-top-color: rgba(5, 7, 10, 0.94) !important;
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.15); }
        }
        .pulse-ring {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>
      <div className="relative w-full h-full">
        <div ref={mapRef} className="w-full h-full" />
        <div className="absolute bottom-14 left-4 z-[400] bg-[#05070a]/90 backdrop-blur-xl p-3 rounded-xl border border-white/[0.06] shadow-2xl pointer-events-none">
          <div className="text-[8px] font-mono uppercase tracking-[0.15em] text-slate-500 mb-2">Ops Efficiency</div>
          <div className="h-1.5 w-24 rounded-full mb-1.5 overflow-hidden" style={{ background: 'linear-gradient(90deg, hsl(0,80%,50%), hsl(40,80%,48%), hsl(80,80%,46%), hsl(120,80%,40%))' }} />
          <div className="flex justify-between text-[7px] font-mono text-slate-600">
            <span>0%</span><span>100%</span>
          </div>
        </div>
      </div>
    </>
  );
}
