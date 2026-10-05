"use client";

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const lon180 = lon => {
  let l = lon % 360;
  if (l > 180) l -= 360;
  if (l < -180) l += 360;
  return l;
};

const KNOWN_FULL_MOON = new Date('2025-01-13T22:27:00Z').getTime();
const LUNAR_MONTH_MS = 29.530588 * 24 * 60 * 60 * 1000;

function getSubsolarLongitude(dateMs) {
  const elapsed = dateMs - KNOWN_FULL_MOON;
  const phase = (elapsed / LUNAR_MONTH_MS) % 1;
  return lon180(-(phase * 360));
}

// True Spherical Trigonometry for the Terminator
// Calculates the curved shadow line factoring in the Moon's 1.54° axial tilt
function getTrueNightPolygons(subsolarLon, simulatedTime, offsetDegrees = 0) {
  const elapsed = simulatedTime - KNOWN_FULL_MOON;
  const phase = (elapsed / LUNAR_MONTH_MS) % 1;
  
  // Moon's axial tilt is 1.54°. This creates the slight sine-wave curve of the terminator.
  const sunLat = 1.54 * Math.sin(phase * 2 * Math.PI);
  const sunLatRad = sunLat * (Math.PI / 180);

  const polyLeft = [];
  const polyRight = [];
  const polyCenter = [];

  // Check if the shadow crosses the -180/180 map boundary
  const isSplit = lon180(subsolarLon + 90) > lon180(subsolarLon - 90);

  // Generate the curve from North Pole to South Pole
  for (let lat = 90; lat >= -90; lat -= 2) {
    const safeLat = Math.max(-89.99, Math.min(89.99, lat));
    const latRad = safeLat * (Math.PI / 180);
    
    // Spherical equation for the terminator longitude
    const C = -Math.tan(latRad) * Math.tan(sunLatRad);
    
    let dLon;
    if (C >= 1) dLon = 0;
    else if (C <= -1) dLon = 180;
    else dLon = Math.acos(C) * (180 / Math.PI);

    // Apply offset for penumbra (soft shadow gradients)
    dLon += offsetDegrees;

    const lEast = lon180(subsolarLon + dLon);
    const lWest = lon180(subsolarLon - dLon);

    if (isSplit) {
      polyRight.push([safeLat, lEast]);
      polyLeft.unshift([safeLat, lWest]);
    } else {
      polyCenter.push([safeLat, lEast]);
    }
  }

  // Close the polygons based on whether they split across the map edge
  if (isSplit) {
    for (let lat = -90; lat <= 90; lat += 2) polyRight.push([lat, 180]);
    for (let lat = 90; lat >= -90; lat -= 2) polyLeft.push([lat, -180]);
    return [polyRight, polyLeft];
  } else {
    for (let lat = -90; lat <= 90; lat += 2) {
      const safeLat = Math.max(-89.99, Math.min(89.99, lat));
      const latRad = safeLat * (Math.PI / 180);
      const C = -Math.tan(latRad) * Math.tan(sunLatRad);
      let dLon;
      if (C >= 1) dLon = 0; else if (C <= -1) dLon = 180; else dLon = Math.acos(C) * (180 / Math.PI);
      dLon += offsetDegrees;
      polyCenter.push([safeLat, lon180(subsolarLon - dLon)]);
    }
    return [polyCenter];
  }
}

export default function LunarMap({ missions, activeId, onSelect, simulatedTime }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  
  // Array of polygon refs for the soft penumbra shadow
  const nightPolygonRefs = useRef([]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const BOUNDS = L.latLngBounds([[-90, -180], [90, 180]]);
    const map = L.map(mapRef.current, {
      crs: L.CRS.EPSG4326, center: [0, 0], zoom: 1, minZoom: 1, maxZoom: 5,
      zoomSnap: 0.5, zoomDelta: 0.5, maxBounds: BOUNDS.pad(0.05),
      maxBoundsViscosity: 1.0, attributionControl: true, zoomControl: true,
      preferCanvas: true
    });

    map.fitBounds(BOUNDS);
    L.imageOverlay('/moon.jpg', BOUNDS).addTo(map);

    // Far Side Overlay
    const farSideStyle = { color: '#ef4444', weight: 0, fillColor: '#ef4444', fillOpacity: 0.25, interactive: false };
    L.polygon([[-90, 90], [90, 90], [90, 180], [-90, 180]], farSideStyle).addTo(map);
    L.polygon([[-90, -180], [90, -180], [90, -90], [-90, -90]], farSideStyle).addTo(map);

    // Initialize 3 Night Polygons to create a blurred "Penumbra" shadow effect
    nightPolygonRefs.current = [
      L.polygon([], { color: '#000', weight: 0, fillColor: '#000', fillOpacity: 0.5, interactive: false }).addTo(map), // Core Umbra
      L.polygon([], { color: '#000', weight: 0, fillColor: '#000', fillOpacity: 0.3, interactive: false }).addTo(map), // Inner Penumbra
      L.polygon([], { color: '#000', weight: 0, fillColor: '#000', fillOpacity: 0.15, interactive: false }).addTo(map) // Outer Penumbra
    ];

    map.zoomControl.setPosition('bottomright');
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !missions) return;

    Object.values(markersRef.current).forEach(m => {
      if(m.glow) map.removeLayer(m.glow);
      if(m.marker) map.removeLayer(m.marker);
    });
    markersRef.current = {};

    missions.forEach(mission => {
      const lat = mission.lat_deg;
      const lng = lon180(mission.lon_east_deg);

      const glow = L.circleMarker([lat, lng], { radius: 16, weight: 1, fillOpacity: 0.15, interactive: false, className: 'pulse-ring' }).addTo(map);
      const marker = L.circleMarker([lat, lng], { radius: 5, weight: 1.5, fillOpacity: 1 }).addTo(map);

      marker.bindTooltip('', { direction: 'top', offset: [0, -10], className: 'moon-tooltip' });
      marker.on('click', (e) => { L.DomEvent.stopPropagation(e); if (onSelect) onSelect(mission.id); });

      markersRef.current[mission.id] = { marker, glow, data: mission };
    });
  }, [missions, onSelect]);

  useEffect(() => {
    if (!mapInstanceRef.current || !nightPolygonRefs.current.length) return;

    const subsolarLon = getSubsolarLongitude(simulatedTime);
    
    // Update the 3 layers of shadow for the soft penumbra gradient
    // Layer 0: Core shadow (offset -2 degrees)
    // Layer 1: Mid shadow (offset 0 degrees)
    // Layer 2: Edge shadow (offset +2 degrees)
    nightPolygonRefs.current[0].setLatLngs(getTrueNightPolygons(subsolarLon, simulatedTime, -2));
    nightPolygonRefs.current[1].setLatLngs(getTrueNightPolygons(subsolarLon, simulatedTime, 0));
    nightPolygonRefs.current[2].setLatLngs(getTrueNightPolygons(subsolarLon, simulatedTime, 2));

    Object.entries(markersRef.current).forEach(([id, { marker, glow, data }]) => {
      const isSelected = id === activeId;
      const lng = lon180(data.lon_east_deg);
      
      const distToSun = Math.abs(lon180(lng - subsolarLon));
      const isDaylight = distToSun <= 90;
      const isEarthLineOfSight = Math.abs(lng) <= 90;
      const isGoldenZone = isDaylight && isEarthLineOfSight;
      
      let color = isGoldenZone ? '#34d399' : (isDaylight ? '#fbbf24' : '#64748b');
      if (!isEarthLineOfSight) color = '#ef4444'; 

      marker.setStyle({ color: isSelected ? '#ffffff' : 'rgba(5,7,10,0.8)', fillColor: color, radius: isSelected ? 8 : 5, weight: isSelected ? 2 : 1.5 });
      glow.setStyle({ color: color, fillColor: color, opacity: isSelected ? 1 : 0, fillOpacity: isSelected ? 0.15 : 0 });

      const statusText = isGoldenZone ? '<span style="color:#34d399">OPERATIONAL (SUN + COMM)</span>' : (!isDaylight ? '<span style="color:#64748b">OFFLINE (NIGHT)</span>' : '<span style="color:#ef4444">OFFLINE (NO EARTH LINK)</span>');
      marker.setTooltipContent(
        `<div style="font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:13px;margin-bottom:3px;color:#fff">${data.name}</div>
         <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:rgba(255,255,255,0.6)">${data.site_name}</div>
         <div style="font-family:'JetBrains Mono',monospace;font-size:10px;margin-top:4px;font-weight:600">${statusText}</div>`
      );
    });

  }, [simulatedTime, activeId]);

  return (
    <>
      <style jsx global>{`
        .leaflet-container { background: #05070a !important; }
        .leaflet-control-zoom { border: none !important; border-radius: 10px !important; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.6) !important; }
        .leaflet-control-zoom a { background: rgba(8, 12, 17, 0.9) !important; backdrop-filter: blur(16px); color: rgba(255, 255, 255, 0.6) !important; border-color: rgba(255, 255, 255, 0.06) !important; width: 34px !important; height: 34px !important; line-height: 34px !important; font-size: 15px !important; font-weight: 400; transition: all 0.2s ease; }
        .leaflet-control-zoom a:hover { background: rgba(14, 20, 30, 0.95) !important; color: #fff !important; }
        .leaflet-control-attribution { display: none !important; }
        .moon-tooltip { background: rgba(5, 7, 10, 0.94) !important; backdrop-filter: blur(20px) saturate(150%); border: 1px solid rgba(255,255,255,0.08) !important; border-radius: 12px !important; padding: 10px 14px !important; box-shadow: 0 12px 40px rgba(0,0,0,0.7) !important; color: #f1f5f9 !important; }
        .moon-tooltip::before { border-top-color: rgba(5, 7, 10, 0.94) !important; }
        @keyframes pulse-glow { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.15); } }
        .pulse-ring { animation: pulse-glow 2s ease-in-out infinite; }
      `}</style>
      <div className="relative w-full h-full">
        <div ref={mapRef} className="w-full h-full" />
        <div className="absolute bottom-6 left-4 z-[400] bg-[#05070a]/90 backdrop-blur-xl p-4 rounded-xl border border-white/[0.06] shadow-2xl pointer-events-none flex flex-col gap-3">
          <div className="text-[10px] font-heading font-semibold uppercase tracking-[0.15em] text-white/80">Map Legend</div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#34d399]" />
              <span className="text-[10px] font-mono text-slate-400">Ops Window (Sun + Earth Link)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#fbbf24]" />
              <span className="text-[10px] font-mono text-slate-400">Daylight Only (No Earth Link)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#ef4444] opacity-50" />
              <span className="text-[10px] font-mono text-slate-400">Far Side (Earth Shadow Zone)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gradient-to-r from-black to-[#222] border border-white/20" />
              <span className="text-[10px] font-mono text-slate-400">Night Side (Penumbra Edge)</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
