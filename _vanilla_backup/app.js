/* ============================================================
   OPS WINDOW — Main Application Logic
   NASA Space Apps 2026 | Lunar Ops Visualizer
   ============================================================ */

// ==================== GLOBAL STATE ====================
const AppState = {
  missions: [],
  selectedMissionId: null,
  map: null,
  markers: {},
  listeners: [],

  subscribe(fn) {
    this.listeners.push(fn);
  },

  selectMission(missionId) {
    const prev = this.selectedMissionId;
    this.selectedMissionId = missionId;
    if (prev !== missionId) {
      this.listeners.forEach(fn => fn(missionId, prev));
    }
  },

  getSelected() {
    return this.missions.find(m => m.mission_id === this.selectedMissionId) || null;
  }
};

// ==================== PROVIDER COLORS ====================
const PROVIDER_COLORS = {
  'NASA':                '#3b82f6',
  'CNSA':                '#ef4444',
  'ISRO':                '#f59e0b',
  'Intuitive Machines':  '#a855f7',
  'Firefly':             '#f97316',
  'NASA / CLPS':         '#06b6d4',
  'JAXA':                '#ec4899',
  'ispace':              '#8b5cf6',
  'default':             '#6b7280'
};

const ERA_SHAPES = {
  'Apollo':  'circle',
  'Modern':  'diamond',
  'CLPS':    'triangle',
  'default': 'circle'
};

function getProviderColor(provider) {
  return PROVIDER_COLORS[provider] || PROVIDER_COLORS['default'];
}

function getEfficiencyColor(eff) {
  if (eff <= 0) return '#ef4444';
  if (eff < 0.3) return '#f97316';
  if (eff < 0.6) return '#f59e0b';
  if (eff < 0.85) return '#22c55e';
  return '#10b981';
}

// ==================== DATA LOADING ====================
async function loadMissions() {
  try {
    const response = await fetch('data/missions.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    AppState.missions = data.missions || [];
    document.getElementById('map-mission-count').textContent =
      `${AppState.missions.length} missions`;
    return AppState.missions;
  } catch (err) {
    console.error('Failed to load missions.json:', err);
    document.getElementById('map-mission-count').textContent = 'Error loading data';
    showErrorState();
    return [];
  }
}

function showErrorState() {
  const sections = ['compare-chart', 'timeline-chart', 'polar-chart'];
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">❌</div>
          <p>Failed to load mission data. Check that data/missions.json exists.</p>
        </div>`;
    }
  });
}

// ==================== LUNAR MAP (Leaflet) ====================
function initMap() {
  // Initialize with EPSG4326 (plain lat/lon, NOT Web Mercator)
  const map = L.map('lunar-map', {
    crs: L.CRS.EPSG4326,
    center: [0, 0],
    zoom: 2,
    minZoom: 1,
    maxZoom: 8,
    maxBounds: [[-90, -180], [90, 180]],
    maxBoundsViscosity: 1.0,
    attributionControl: true
  });

  // Try Moon Trek WMTS tiles first
  const tileUrl = 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd/1.0.0/default/default028mm/{z}/{y}/{x}.png';

  const moonTiles = L.tileLayer(tileUrl, {
    attribution: 'NASA/GSFC/ASU | Moon Trek',
    maxZoom: 8,
    tms: false,
    errorTileUrl: ''
  });

  // Track tile errors for fallback
  let tileErrors = 0;
  let tilesLoaded = 0;
  let fallbackTriggered = false;

  moonTiles.on('tileerror', () => {
    tileErrors++;
    if (tileErrors > 5 && !fallbackTriggered) {
      fallbackTriggered = true;
      console.warn('Moon Trek tiles failing, attempting USGS fallback...');
      tryUSGSFallback(map, moonTiles);
    }
  });

  moonTiles.on('tileload', () => {
    tilesLoaded++;
  });

  moonTiles.addTo(map);

  // Check after 8 seconds if no tiles loaded
  setTimeout(() => {
    if (tilesLoaded === 0 && !fallbackTriggered) {
      fallbackTriggered = true;
      console.warn('No tiles loaded after timeout, using static fallback...');
      useStaticFallback(map, moonTiles);
    }
  }, 8000);

  AppState.map = map;
  return map;
}

function tryUSGSFallback(map, oldLayer) {
  map.removeLayer(oldLayer);

  const usgsUrl = 'https://planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/earth/moon_simp_cyl.map&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=LOLA_color&SRS=EPSG:4326&BBOX={bbox}&WIDTH=256&HEIGHT=256&FORMAT=image/png';

  // If USGS also fails, go to static
  console.log('Attempting USGS tile layer...');
  useStaticFallback(map, null);
}

function useStaticFallback(map, oldLayer) {
  if (oldLayer) map.removeLayer(oldLayer);

  // Use a simple gray gradient as emergency fallback
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Draw a basic moon surface representation
  const gradient = ctx.createRadialGradient(512, 256, 50, 512, 256, 512);
  gradient.addColorStop(0, '#8a8a8a');
  gradient.addColorStop(0.5, '#5a5a5a');
  gradient.addColorStop(1, '#2a2a2a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 512);

  // Add some crater-like features
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 512;
    const r = Math.random() * 30 + 5;
    const craterGrad = ctx.createRadialGradient(x, y, 0, x, y, r);
    craterGrad.addColorStop(0, 'rgba(40,40,40,0.6)');
    craterGrad.addColorStop(0.7, 'rgba(60,60,60,0.3)');
    craterGrad.addColorStop(1, 'rgba(80,80,80,0)');
    ctx.fillStyle = craterGrad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  const dataUrl = canvas.toDataURL();
  L.imageOverlay(dataUrl, [[-90, -180], [90, 180]]).addTo(map);
  console.log('Using static fallback image for lunar surface');
}

function addMissionMarkers(missions) {
  missions.forEach(mission => {
    // Longitude conversion: east-positive 0-360 → -180 to +180
    let lon = mission.lon_east_deg;
    if (lon > 180) lon = lon - 360;

    const eff = mission.metrics.ops_efficiency;
    const color = getEfficiencyColor(eff);
    const size = 14;

    const icon = L.divIcon({
      className: 'mission-marker-wrapper',
      html: `<div class="mission-marker" 
                  data-mission-id="${mission.mission_id}"
                  style="width:${size}px;height:${size}px;background:${color};"
                  role="button"
                  aria-label="${mission.mission}: Ops efficiency ${(eff * 100).toFixed(0)}%"
                  tabindex="0"></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });

    const marker = L.marker([mission.lat_deg, lon], { icon })
      .addTo(AppState.map);

    marker.on('click', () => {
      AppState.selectMission(mission.mission_id);
    });

    // Tooltip
    marker.bindTooltip(
      `<strong>${mission.mission}</strong><br>
       ${mission.site_name}<br>
       Ops: ${(eff * 100).toFixed(0)}%`,
      {
        className: 'leaflet-tooltip-custom',
        direction: 'top',
        offset: [0, -10]
      }
    );

    AppState.markers[mission.mission_id] = { marker, element: null };
  });

  // Store marker DOM elements after they're rendered
  setTimeout(() => {
    document.querySelectorAll('.mission-marker').forEach(el => {
      const id = el.getAttribute('data-mission-id');
      if (AppState.markers[id]) {
        AppState.markers[id].element = el;
      }
    });
  }, 500);
}

// ==================== COMPARE CHART (D3 Scatter) ====================
function buildCompareChart(missions) {
  const container = document.getElementById('compare-chart');
  container.innerHTML = '';

  const rect = container.getBoundingClientRect();
  const margin = { top: 20, right: 30, bottom: 50, left: 55 };
  const width = rect.width - margin.left - margin.right;
  const height = 280 - margin.top - margin.bottom;

  const svg = d3.select('#compare-chart')
    .append('svg')
    .attr('width', rect.width)
    .attr('height', 280)
    .attr('role', 'img')
    .attr('aria-label', 'Scatter plot of landing latitude versus ops efficiency');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Scales
  const x = d3.scaleLinear()
    .domain([-90, 90])
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain([0, 1.05])
    .range([height, 0]);

  // Grid
  g.append('g')
    .attr('class', 'chart-grid')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).tickSize(-height).tickFormat(''));

  g.append('g')
    .attr('class', 'chart-grid')
    .call(d3.axisLeft(y).tickSize(-width).tickFormat(''));

  // Axes
  g.append('g')
    .attr('class', 'chart-axis')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(9).tickFormat(d => `${d}°`));

  g.append('g')
    .attr('class', 'chart-axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${(d * 100).toFixed(0)}%`));

  // Axis labels
  svg.append('text')
    .attr('x', margin.left + width / 2)
    .attr('y', 280 - 6)
    .attr('text-anchor', 'middle')
    .attr('fill', 'var(--text-dim)')
    .attr('font-size', '0.72rem')
    .attr('font-family', 'var(--font-mono)')
    .text('Landing Latitude');

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -(margin.top + height / 2))
    .attr('y', 14)
    .attr('text-anchor', 'middle')
    .attr('fill', 'var(--text-dim)')
    .attr('font-size', '0.72rem')
    .attr('font-family', 'var(--font-mono)')
    .text('Ops Efficiency');

  // Zero line
  g.append('line')
    .attr('x1', 0).attr('x2', width)
    .attr('y1', y(0)).attr('y2', y(0))
    .attr('stroke', 'rgba(255,255,255,0.1)')
    .attr('stroke-width', 1);

  // Tooltip
  const tooltip = d3.select('body').append('div')
    .attr('class', 'chart-tooltip');

  // Dots
  const dots = g.selectAll('.compare-dot')
    .data(missions)
    .enter()
    .append('circle')
    .attr('class', 'compare-dot')
    .attr('cx', d => x(d.lat_deg))
    .attr('cy', d => y(d.metrics.ops_efficiency))
    .attr('r', 8)
    .attr('fill', d => getProviderColor(d.provider))
    .attr('data-mission-id', d => d.mission_id)
    .on('mouseenter', function(event, d) {
      tooltip
        .html(`
          <div class="tooltip-title">${d.mission}</div>
          <div class="tooltip-row"><span>Provider</span><span class="tooltip-value">${d.provider}</span></div>
          <div class="tooltip-row"><span>Latitude</span><span class="tooltip-value">${d.lat_deg.toFixed(2)}°</span></div>
          <div class="tooltip-row"><span>Ops Efficiency</span><span class="tooltip-value">${(d.metrics.ops_efficiency * 100).toFixed(1)}%</span></div>
          <div class="tooltip-row"><span>Status</span><span class="tooltip-value">${d.status}</span></div>
        `)
        .style('left', (event.pageX + 12) + 'px')
        .style('top', (event.pageY - 10) + 'px')
        .classed('visible', true);
    })
    .on('mousemove', function(event) {
      tooltip
        .style('left', (event.pageX + 12) + 'px')
        .style('top', (event.pageY - 10) + 'px');
    })
    .on('mouseleave', function() {
      tooltip.classed('visible', false);
    })
    .on('click', function(event, d) {
      AppState.selectMission(d.mission_id);
    });

  // Animate dots in
  dots
    .attr('r', 0)
    .transition()
    .duration(600)
    .delay((d, i) => i * 100)
    .attr('r', 8)
    .ease(d3.easeCubicOut);

  // Build legend
  buildCompareLegend(missions);

  // Listen for selection changes
  AppState.subscribe((missionId) => {
    dots.classed('selected', d => d.mission_id === missionId);
  });
}

function buildCompareLegend(missions) {
  const providers = [...new Set(missions.map(m => m.provider))];
  const legendContainer = document.getElementById('compare-legend');
  legendContainer.innerHTML = providers.map(p => `
    <div class="legend-item">
      <div class="legend-dot" style="background:${getProviderColor(p)}"></div>
      ${p}
    </div>
  `).join('');
}

// ==================== TIMELINE CHART (D3 Horizontal Bars) ====================
function buildTimelineChart(missions) {
  const container = document.getElementById('timeline-chart');
  container.innerHTML = '';

  const rect = container.getBoundingClientRect();
  const margin = { top: 10, right: 20, bottom: 30, left: 120 };
  const rowHeight = 50;
  const height = missions.length * rowHeight + margin.top + margin.bottom;
  const width = rect.width - margin.left - margin.right;

  const svg = d3.select('#timeline-chart')
    .append('svg')
    .attr('width', rect.width)
    .attr('height', Math.max(height, 280))
    .attr('role', 'img')
    .attr('aria-label', 'Timeline showing sun, Earth, and overlap intervals per mission');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Find max hours across all intervals
  let maxHour = 0;
  missions.forEach(m => {
    ['sun', 'earth', 'overlap'].forEach(key => {
      (m.intervals[key] || []).forEach(([s, e]) => {
        if (e > maxHour) maxHour = e;
      });
    });
  });

  // Scales
  const x = d3.scaleLinear()
    .domain([0, Math.min(maxHour, 2200)])
    .range([0, width]);

  const y = d3.scaleBand()
    .domain(missions.map(m => m.mission_id))
    .range([0, missions.length * rowHeight])
    .padding(0.3);

  // Time axis
  g.append('g')
    .attr('class', 'chart-axis')
    .attr('transform', `translate(0,${missions.length * rowHeight})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d => `${d}h`));

  // Grid
  g.append('g')
    .attr('class', 'chart-grid')
    .call(d3.axisTop(x).tickSize(-(missions.length * rowHeight)).tickFormat(''))
    .attr('transform', 'translate(0,0)');

  // Bars for each mission
  const barHeight = y.bandwidth() / 3 - 1;
  const colors = {
    sun: '#f59e0b',
    earth: '#14b8a6',
    overlap: '#22c55e'
  };
  const offsets = { sun: 0, earth: 1, overlap: 2 };

  missions.forEach(mission => {
    const missionG = g.append('g')
      .attr('class', 'timeline-row')
      .attr('data-mission-id', mission.mission_id);

    // Mission label
    missionG.append('text')
      .attr('class', 'timeline-label')
      .attr('x', -8)
      .attr('y', y(mission.mission_id) + y.bandwidth() / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .text(mission.mission.length > 15 ? mission.mission.slice(0, 14) + '…' : mission.mission)
      .on('click', () => AppState.selectMission(mission.mission_id));

    ['sun', 'earth', 'overlap'].forEach(key => {
      const intervals = mission.intervals[key] || [];
      const barY = y(mission.mission_id) + offsets[key] * (barHeight + 1);

      intervals.forEach(([start, end]) => {
        // Clamp to visible range
        const clampedStart = Math.max(0, start);
        const clampedEnd = Math.min(end, x.domain()[1]);
        if (clampedStart >= clampedEnd) return;

        missionG.append('rect')
          .attr('class', 'timeline-bar')
          .attr('x', x(clampedStart))
          .attr('y', barY)
          .attr('width', 0)
          .attr('height', barHeight)
          .attr('fill', colors[key])
          .attr('opacity', key === 'overlap' ? 0.9 : 0.5)
          .on('click', () => AppState.selectMission(mission.mission_id))
          .transition()
          .duration(800)
          .delay(offsets[key] * 150)
          .attr('width', x(clampedEnd) - x(clampedStart))
          .ease(d3.easeCubicOut);
      });
    });
  });

  // Legend
  const legendContainer = document.getElementById('timeline-legend');
  legendContainer.innerHTML = `
    <div class="legend-item"><div class="legend-line" style="background:#f59e0b"></div> Sun Visible</div>
    <div class="legend-item"><div class="legend-line" style="background:#14b8a6"></div> Earth Visible</div>
    <div class="legend-item"><div class="legend-line" style="background:#22c55e"></div> Ops Window (Overlap)</div>
  `;

  // Selection listener
  AppState.subscribe((missionId) => {
    g.selectAll('.timeline-row').each(function() {
      const row = d3.select(this);
      const rowId = row.attr('data-mission-id');
      if (missionId) {
        row.classed('selected', rowId === missionId);
        row.classed('dimmed', rowId !== missionId);
      } else {
        row.classed('selected', false);
        row.classed('dimmed', false);
      }
    });
  });
}

// ==================== POLAR SKY PLOT (D3 Circular) ====================
function buildPolarPlot(mission) {
  const container = document.getElementById('polar-chart');
  const emptyState = document.getElementById('polar-empty');
  const legend = document.getElementById('polar-legend');
  const missionLabel = document.getElementById('polar-mission-label');

  if (!mission) {
    container.querySelectorAll('svg').forEach(el => el.remove());
    if (emptyState) emptyState.style.display = 'flex';
    if (legend) legend.style.display = 'none';
    missionLabel.textContent = 'Select a mission';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (legend) legend.style.display = 'flex';
  missionLabel.textContent = mission.mission;

  // Remove old SVG
  container.querySelectorAll('svg').forEach(el => el.remove());

  const size = Math.min(container.offsetWidth, 300);
  const radius = size / 2 - 30;
  const cx = size / 2;
  const cy = size / 2;

  const svg = d3.select('#polar-chart')
    .append('svg')
    .attr('width', size)
    .attr('height', size)
    .attr('role', 'img')
    .attr('aria-label', `Sky plot for ${mission.mission} showing Sun and Earth paths`);

  const g = svg.append('g')
    .attr('transform', `translate(${cx},${cy})`);

  // Elevation scale: 90° at center, 0° at rim, negative beyond
  const elevationScale = d3.scaleLinear()
    .domain([90, -90])
    .range([0, radius]);

  // Concentric elevation rings
  [0, 15, 30, 45, 60, 75, 90].forEach(elev => {
    const r = elevationScale(elev);
    g.append('circle')
      .attr('class', elev === 0 ? 'polar-horizon-ring' : 'polar-ring')
      .attr('cx', 0).attr('cy', 0)
      .attr('r', r);

    if (elev % 30 === 0 && elev !== 90) {
      g.append('text')
        .attr('x', r + 4)
        .attr('y', 4)
        .attr('class', 'polar-axis-label')
        .attr('text-anchor', 'start')
        .attr('font-size', '0.55rem')
        .text(`${elev}°`);
    }
  });

  // Compass directions
  const directions = [
    { label: 'N', az: 0 }, { label: 'E', az: 90 },
    { label: 'S', az: 180 }, { label: 'W', az: 270 }
  ];

  directions.forEach(({ label, az }) => {
    const rad = (az - 90) * Math.PI / 180;
    const lineR = elevationScale(-10);
    g.append('line')
      .attr('class', 'polar-axis-line')
      .attr('x1', 0).attr('y1', 0)
      .attr('x2', Math.cos(rad) * lineR)
      .attr('y2', Math.sin(rad) * lineR);

    const labelR = radius + 16;
    g.append('text')
      .attr('class', 'polar-axis-label')
      .attr('x', Math.cos(rad) * labelR)
      .attr('y', Math.sin(rad) * labelR + 4)
      .text(label);
  });

  // Convert az/el to x/y
  function polarToXY(az, el) {
    const r = elevationScale(el);
    const rad = (az - 90) * Math.PI / 180;
    return [Math.cos(rad) * r, Math.sin(rad) * r];
  }

  // Draw paths
  const drawPath = (trackData, className) => {
    if (!trackData || trackData.length < 2) return;

    const line = d3.line()
      .x(d => polarToXY(d.az, d.el)[0])
      .y(d => polarToXY(d.az, d.el)[1])
      .curve(d3.curveCatmullRom.alpha(0.5));

    const path = g.append('path')
      .datum(trackData)
      .attr('class', className)
      .attr('d', line);

    // Animate
    const totalLength = path.node().getTotalLength();
    path
      .attr('stroke-dasharray', totalLength)
      .attr('stroke-dashoffset', totalLength)
      .transition()
      .duration(1500)
      .ease(d3.easeCubicInOut)
      .attr('stroke-dashoffset', 0);
  };

  if (mission.tracks) {
    drawPath(mission.tracks.sun, 'polar-sun-path');
    drawPath(mission.tracks.earth, 'polar-earth-path');
  }
}

// ==================== DETAIL PANEL ====================
function openDetailPanel(mission) {
  const panel = document.getElementById('detail-panel');
  const overlay = document.getElementById('panel-overlay');
  const panelName = document.getElementById('panel-mission-name');
  const content = document.getElementById('panel-content');

  panelName.textContent = mission.mission;

  const effPercent = (mission.metrics.ops_efficiency * 100).toFixed(1);
  const effColor = getEfficiencyColor(mission.metrics.ops_efficiency);

  content.innerHTML = `
    <!-- Efficiency Gauge -->
    <div class="efficiency-gauge">
      <div class="gauge-value" style="color:${effColor}">${effPercent}%</div>
      <div class="gauge-label">Ops Efficiency</div>
      <div class="efficiency-bar">
        <div class="efficiency-bar-fill" style="width:${effPercent}%;background:${effColor}"></div>
      </div>
    </div>

    <!-- Metrics -->
    <div class="metrics-grid">
      <div class="metric-card sun-card">
        <div class="metric-value">${formatHours(mission.metrics.sun_hours)}</div>
        <div class="metric-label">☀ Sun Hours</div>
      </div>
      <div class="metric-card earth-card">
        <div class="metric-value">${formatHours(mission.metrics.earth_hours)}</div>
        <div class="metric-label">🌍 Earth Hours</div>
      </div>
      <div class="metric-card overlap-card">
        <div class="metric-value">${formatHours(mission.metrics.overlap_hours)}</div>
        <div class="metric-label">⚡ Overlap</div>
      </div>
    </div>

    <!-- Mission Info -->
    <div class="detail-group" style="margin-top:24px">
      <div class="detail-group-title">Mission Information</div>
      <div class="detail-field">
        <span class="detail-label">Provider</span>
        <span class="detail-value">${mission.provider}</span>
      </div>
      <div class="detail-field">
        <span class="detail-label">Landing Site</span>
        <span class="detail-value">${mission.site_name}</span>
      </div>
      <div class="detail-field">
        <span class="detail-label">Coordinates</span>
        <span class="detail-value" style="font-family:var(--font-mono);font-size:0.8rem">
          ${mission.lat_deg.toFixed(4)}° N, ${mission.lon_east_deg.toFixed(4)}° E
        </span>
      </div>
      <div class="detail-field">
        <span class="detail-label">Landing Date</span>
        <span class="detail-value">${mission.landing_utc ? new Date(mission.landing_utc).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'TBD'}</span>
      </div>
      <div class="detail-field">
        <span class="detail-label">Status</span>
        <span class="detail-value"><span class="badge badge-${mission.status}">${mission.status}</span></span>
      </div>
      <div class="detail-field">
        <span class="detail-label">Ops Duration</span>
        <span class="detail-value">${mission.ops_duration}</span>
      </div>
      <div class="detail-field">
        <span class="detail-label">End Reason</span>
        <span class="detail-value">${mission.end_reason}</span>
      </div>
      <div class="detail-field">
        <span class="detail-label">Confidence</span>
        <span class="detail-value"><span class="badge badge-${mission.confidence}">${mission.confidence}</span></span>
      </div>
    </div>

    <!-- Payloads -->
    <div class="detail-group">
      <div class="detail-group-title">Payloads</div>
      ${mission.payloads.map(p => `
        <div class="detail-field" style="border-bottom:none;padding:2px 0">
          <span class="detail-value" style="color:var(--text-secondary);font-weight:400">• ${p}</span>
        </div>
      `).join('')}
    </div>

    <!-- Source -->
    ${mission.source_url ? `
      <div class="detail-group">
        <div class="detail-group-title">Data Source</div>
        <a href="${mission.source_url}" target="_blank" rel="noopener"
           style="font-size:0.8rem;word-break:break-all">
          ${mission.source_url}
        </a>
      </div>
    ` : ''}
  `;

  panel.classList.add('active');
  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');
}

function closeDetailPanel() {
  document.getElementById('detail-panel').classList.remove('active');
  document.getElementById('panel-overlay').classList.remove('active');
  document.getElementById('panel-overlay').setAttribute('aria-hidden', 'true');
  AppState.selectMission(null);
}

function formatHours(h) {
  if (h >= 1000) return `${(h / 24).toFixed(0)}d`;
  return `${h}h`;
}

// ==================== MAP MARKER SELECTION SYNC ====================
function syncMarkerSelection(missionId, prevId) {
  // Deselect previous
  if (prevId && AppState.markers[prevId] && AppState.markers[prevId].element) {
    AppState.markers[prevId].element.classList.remove('selected');
  }

  // Select new
  if (missionId && AppState.markers[missionId] && AppState.markers[missionId].element) {
    AppState.markers[missionId].element.classList.add('selected');

    // Pan map to selected marker
    const mission = AppState.missions.find(m => m.mission_id === missionId);
    if (mission) {
      let lon = mission.lon_east_deg;
      if (lon > 180) lon -= 360;
      AppState.map.panTo([mission.lat_deg, lon], { animate: true, duration: 0.5 });
    }
  }
}

// ==================== MODAL HANDLERS ====================
function initModals() {
  const aboutBtn = document.getElementById('btn-about');
  const aboutModal = document.getElementById('about-modal');
  const closeModalBtn = document.getElementById('btn-close-modal');

  aboutBtn.addEventListener('click', () => {
    aboutModal.classList.add('active');
    aboutModal.setAttribute('aria-hidden', 'false');
  });

  closeModalBtn.addEventListener('click', () => {
    aboutModal.classList.remove('active');
    aboutModal.setAttribute('aria-hidden', 'true');
  });

  aboutModal.addEventListener('click', (e) => {
    if (e.target === aboutModal) {
      aboutModal.classList.remove('active');
      aboutModal.setAttribute('aria-hidden', 'true');
    }
  });
}

// ==================== KEYBOARD NAVIGATION ====================
function initKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDetailPanel();
      // Close modal too
      const modal = document.getElementById('about-modal');
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
    }
  });
}

// ==================== WINDOW RESIZE ====================
let resizeTimeout;
function initResize() {
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (AppState.missions.length > 0) {
        buildCompareChart(AppState.missions);
        buildTimelineChart(AppState.missions);
        const selected = AppState.getSelected();
        if (selected) buildPolarPlot(selected);
      }
      if (AppState.map) AppState.map.invalidateSize();
    }, 300);
  });
}

// ==================== INITIALIZATION ====================
async function init() {
  console.log('🌙 Ops Window — Initializing...');

  // Init modals and keyboard
  initModals();
  initKeyboard();
  initResize();

  // Init map
  const map = initMap();

  // Load data
  const missions = await loadMissions();
  if (missions.length === 0) return;

  // Add markers to map
  addMissionMarkers(missions);

  // Build charts
  buildCompareChart(missions);
  buildTimelineChart(missions);

  // Subscribe to selection changes
  AppState.subscribe((missionId, prevId) => {
    syncMarkerSelection(missionId, prevId);

    const mission = AppState.getSelected();
    if (mission) {
      openDetailPanel(mission);
      buildPolarPlot(mission);
    } else {
      buildPolarPlot(null);
    }
  });

  // Panel close handlers
  document.getElementById('btn-close-panel').addEventListener('click', closeDetailPanel);
  document.getElementById('panel-overlay').addEventListener('click', closeDetailPanel);

  console.log(`🚀 Ops Window loaded — ${missions.length} missions`);
}

// Boot
document.addEventListener('DOMContentLoaded', init);
