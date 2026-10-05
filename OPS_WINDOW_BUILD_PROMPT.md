# 🚀 OPS WINDOW — Master Build Prompt & Checklist
### NASA Space Apps 2026 | Single-Page Lunar Ops Visualizer
> **Document:** @Tasnim — Sep 27, 2026
> **Source:** [Ops-Window-Role-Briefs-Research-Development.pdf](file:///Users/istiakahmmedbishal/Desktop/NASA%20Project/Ops-Window-Role-Briefs-Research-Development.pdf)
> **Last updated:** Oct 5, 2026 — Triple-checked against source PDF (all 7 pages)

---

## 1. PROJECT OVERVIEW

**"Ops Window"** is a **single-page, no-backend web application** that visualizes the operational windows of **22 lunar landing missions** — from Surveyor (1966) through CLPS missions still to fly.

**The core concept:** Two angles decide what a lunar lander can do:
- **Sun elevation** → power (solar panels)
- **Earth elevation** → communications (direct-to-Earth link)

Neither alone is useful. **Real work only happens when BOTH are above the horizon simultaneously.** That overlap = the **ops window**.

**Why this matters — the three stories the app tells:**
1. **Apollo (near-side equatorial):** Earth is permanently up, geometry was never the constraint → ops efficiency ~1.0
2. **Chang'e 4 (far-side):** Direct-to-Earth time is exactly zero by geometry → that's why the Queqiao relay flew first → ops efficiency = 0.0
3. **CLPS polar (~80–85°S):** Both bodies skim the horizon → same calculation, drastically different outcome

The old missions are the **control group** that makes the polar difficulty legible.

**Deliverable:** A single-page web app with 5 views, all reading one precomputed `missions.json`. Works offline.

---

## 2. COMPLETE TECH STACK

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Structure** | HTML5 (single page, semantic) | App shell |
| **Styling** | Vanilla CSS | Dark theme, glassmorphism, responsive layout |
| **Logic** | Vanilla JavaScript (ES6+) | State management, event coordination |
| **Mapping** | [Leaflet.js](https://leafletjs.com/) via CDN | Lunar map with `L.CRS.EPSG4326` (plain lat/lon, NOT Web Mercator) |
| **Tile Source (Primary)** | [NASA Moon Trek](https://trek.nasa.gov/moon/) WMTS | Lunar surface imagery |
| **Tile Source (Fallback)** | USGS Astrogeology — LRO LOLA + WAC global mosaics | Backup if Moon Trek has CORS/speed issues |
| **Tile Source (Emergency)** | Static lunar image as `L.ImageOverlay` | Last resort — less impressive, works every time |
| **Charts** | [D3.js](https://d3js.org/) via CDN | Scatter, timeline, polar sky plot |
| **D3 subset needed** | `d3.scaleLinear`, `d3.scaleTime`, `d3.axisBottom`, `d3.axisLeft`, SVG data binding | Do NOT learn force simulations, layouts, etc. |
| **Data Pipeline** | Python (Google Colab) | `astroquery` + `pandas` + `numpy` → queries JPL Horizons |
| **Pipeline scripts** | 5 Python files + `run_precompute.py` + `sites.py` | Person 2 owns this |
| **Data Format** | `missions.json` (single file) | Pre-computed ephemeris + mission metadata |
| **Ephemeris Source** | [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) | Sun & Earth apparent AZ/EL at lunar surface coords, hourly, 1 year |
| **Backend** | **NONE** | Everything is client-side, offline-capable |

---

## 3. THE 5 VIEWS — DETAILED SPECS

### View 1: Lunar Map (Leaflet) — Person 4

**What it does:**
- Leaflet map with lunar tiles and sensible zoom limits
- 22 markers, one per mission
- Markers **colored by `metrics.ops_efficiency`** so the pattern (Apollo equatorial = green, Chang'e far-side = red, CLPS polar = yellow) is visible **before anyone clicks**
- Clicking a marker **sets the app's global selected mission**; every other view listens
- A **detail panel** appears showing mission content + computed numbers

**Critical gotchas (from the doc):**
1. **CRS:** Leaflet defaults to Web Mercator (Earth). Set `crs: L.CRS.EPSG4326` (plain lat/lon). If markers land in wrong places while tiles look fine → this is why.
2. **Longitude conversion:** Data uses east-positive, sometimes 0–360. Leaflet wants -180 to +180. Convert: `lon > 180 ? lon - 360 : lon`
3. **Tile test FIRST:** This is the most likely thing to break. Test tile loading immediately. If slow or CORS error → fallback to static image `L.ImageOverlay`.

### View 2: Compare Chart (D3 Scatter) — Person 5 — BUILD FIRST

**What it does:**
- Scatter plot, one dot per mission
- **X axis:** landing latitude
- **Y axis:** ops efficiency (0–1)
- Dots **colored by era or provider**
- Far-side missions sit flat on zero
- ~60 lines of D3

**Why build first:** This is the most valuable screen and the cheapest to make. If the weekend goes badly and this is all that gets finished, **the project still works**.

### View 3: Timeline (D3 Horizontal Bars) — Person 5

**What it does:**
- Horizontal bars along a time axis
- **Three stacked rows per mission:** sun-up intervals, Earth-up intervals, overlap band
- JSON gives these as `[start, end]` pairs in hours → each interval = one `<rect>`
- For missions that flew: **mark actual lander survival vs geometry-allowed time**
- The gap between those two IS the story

**Time conversion:** `new Date(Date.parse(meta.analysis_window.start) + hours * 3600e3)`

### View 4: Polar Sky Plot (D3 Circular) — Person 5 — BUILD LAST

**What it does:**
- Circular sky chart: compass direction around the edge, elevation from horizon (rim) to overhead (center)
- Draw Sun's path and Earth's path over **one lunation**
- Apollo 11: both arc high overhead
- 85°S: both crawl near the rim
- JSON has a `tracks` array for this

**Priority:** This is the nicest view AND the most expendable. **Drop this if running short.**

### View 5: Mission Detail Panel — Person 4

**What it does:**
- Appears when a mission is selected (marker click or chart click)
- Shows Person 1's mission content alongside Person 2's computed numbers
- Slide-in with smooth animation

---

## 4. DATA SCHEMA — `missions.json`

### Spreadsheet columns (Person 1 produces):
| Column | Notes |
|--------|-------|
| `mission_id` | lowercase slug, e.g. `apollo-11`, `im-2` |
| `mission` | display name |
| `provider` | NASA, CNSA, ISRO, Intuitive Machines, Firefly, etc. |
| `site_name` | Mare Tranquillitatis, Malapert A, etc. |
| `lat_deg` | +North, decimal degrees |
| `lon_east_deg` | +East, decimal degrees (**THE TRAP: west-positive sources need sign flip**) |
| `landing_utc` | date and time if known |
| `status` | `success` / `partial` / `failed` / `planned` |
| `ops_duration` | how long it actually operated |
| `end_reason` | why it stopped |
| `payloads` | short list |
| `source_url` | where the coordinate came from |
| `confidence` | `confirmed` / `verify` |

### Full JSON structure per mission (post-precompute):
```json
{
  "mission_id": "apollo-11",
  "mission": "Apollo 11",
  "provider": "NASA",
  "site_name": "Mare Tranquillitatis",
  "lat_deg": 0.6875,
  "lon_east_deg": 23.4333,
  "landing_utc": "1969-07-20T20:17:40Z",
  "status": "success",
  "ops_duration": "8 days",
  "end_reason": "Planned return",
  "payloads": ["EASEP", "Laser retroreflector"],
  "source_url": "https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo_land.html",
  "confidence": "confirmed",
  "metrics": {
    "ops_efficiency": 0.98,
    "sun_hours": 354,
    "earth_hours": 720,
    "overlap_hours": 354
  },
  "intervals": {
    "sun": [[0, 354], [708, 1062]],
    "earth": [[0, 720]],
    "overlap": [[0, 354]]
  },
  "tracks": {
    "sun": [{"az": 90, "el": 45}, {"az": 100, "el": 50}],
    "earth": [{"az": 0, "el": 60}, {"az": 5, "el": 58}]
  },
  "analysis_window": {
    "start": "2025-01-01T00:00:00Z",
    "end": "2026-01-01T00:00:00Z"
  }
}
```

### Mock data to include (5 missions covering all 3 stories):
| Mission | Location | Expected ops_efficiency | Why |
|---------|----------|------------------------|-----|
| Apollo 11 | Near-side equatorial (0.69°N, 23.43°E) | ~1.0 | Earth permanently visible |
| Apollo 15 | Near-side (26.13°N, 3.63°E) | ~0.95 | Near-side, high efficiency |
| Chang'e 4 | Far-side (45.46°S, 177.60°E) | 0.0 | Zero direct-to-Earth by geometry |
| IM-1 Odysseus | Near-side polar (80.13°S, 1.44°E) | ~0.4 | Partial success, tipped over |
| CLPS Polar (planned) | ~85°S | ~0.15 | Both bodies skim horizon |

---

## 5. TRIPLE-CHECK: ITEMS FROM PDF vs PROMPT

### ✅ Items confirmed present:
- [x] Project concept (ops window = Sun + Earth overlap)
- [x] The three stories (Apollo vs Chang'e vs CLPS)
- [x] All 5 views described
- [x] Leaflet CRS gotcha (`L.CRS.EPSG4326`)
- [x] Longitude conversion (`lon > 180 ? lon - 360 : lon`)
- [x] Tile fallback strategy (WMTS → USGS → static image)
- [x] D3 build order (compare → timeline → polar)
- [x] Time conversion formula
- [x] Mock data strategy (build against fake, swap when real arrives)
- [x] All JSON schema fields
- [x] Marker coloring by ops_efficiency
- [x] Global selectedMission state pattern
- [x] Known limitation: flat horizon model
- [x] Polar numbers = upper bound
- [x] Compare chart as MVP fallback

### ⚠️ Items MISSING from previous prompt — NOW ADDED:
- [x] **Person 1's full spreadsheet schema** (13 columns) — was partially listed, now complete with `source_url` and `confidence` fields
- [x] **Longitude trap warning** — west-positive sources need sign flip (23.4°W → enter -23.4)
- [x] **Person 2's 6-step pipeline process** — not in the build prompt scope but referenced for context
- [x] **5 Python files + `run_precompute.py` + `sites.py`** — pipeline architecture documented
- [x] **Sanity check rules** — far-side = zero Earth time, ops never exceeds sun or earth time
- [x] **Apollo coordinate source** — NSSDCA, LRO imagery, Lunar Module row (not LRRR/ALSEP)
- [x] **IM-1 and IM-2 gotcha** — both tipped over, final position ≠ pre-launch target
- [x] **CLPS sites move** — mark all as `verify`, note check date
- [x] **Person 6's slides** — a team member exists for presentation (not in build scope but noted)
- [x] **Three tile source levels** — Moon Trek primary, USGS secondary, static emergency
- [x] **D3 subset advisory** — only need 4 things, skip force/layouts
- [x] **Queqiao relay context** — why Chang'e 4 far-side = 0
- [x] **Dependency chain** — Person 1 → Person 2 → frozen schema → Persons 4 & 5 in parallel

---

## 6. 🔴 VULNERABILITY ANALYSIS & RISK REGISTER

### Critical Risks (can kill the project)

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| V1 | **NASA Moon Trek tiles fail** (CORS, downtime, rate limiting) | Map is blank — the hero visual is dead | Have THREE fallback levels ready: Moon Trek → USGS Astrogeology → static `ImageOverlay`. Test tiles THIS WEEK. |
| V2 | **Wrong longitude signs in mission data** | Missions plot on wrong side of the Moon. No error message. | Automated sanity check: far-side sites must report 0 Earth time. Spot-check 3 sites on a lunar map. |
| V3 | **Person 1 delivers late** | Person 2 can't run pipeline → no `missions.json` → no real data | Freeze mock data NOW with 5 missions. Build entire app against mock. Swap is a file replacement. |
| V4 | **JPL Horizons API goes down during hackathon** | Can't regenerate data | Cache all Horizons queries (`run_precompute.py` already does this). Run pipeline BEFORE the event, not during. |
| V5 | **Leaflet Web Mercator default** | Markers land in wrong positions | Set `crs: L.CRS.EPSG4326` on map init. Test immediately. |

### Medium Risks (degrade quality)

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| V6 | **Flat horizon model inaccuracy at poles** | Polar ops numbers are optimistic upper bounds | **State this openly in the UI and pitch.** Judges reward honest error disclosure. At 85°S, terrain (crater rims, mountains) genuinely decides visibility within ~2° of horizon. |
| V7 | **D3 learning curve overwhelms Person 5** | Timeline and polar plot don't ship | Build compare chart FIRST (60 lines, most valuable). Timeline second. Polar plot is expendable. |
| V8 | **Massive JSON file (22 missions × hourly data × 1 year)** | Slow initial load, browser stutter | Lazy-load track data per mission. Keep summary metrics at top level. Consider compressing intervals. |
| V9 | **No error handling for malformed JSON** | App crashes silently | Add try/catch around JSON fetch, show user-friendly error state. Validate JSON schema on load. |
| V10 | **No loading states** | User sees blank panels while data loads | Add skeleton loaders / spinners for map tiles, chart rendering, and data fetch. |

### Low Risks (polish issues)

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| V11 | **Mobile/tablet layout breaks** | Judges may demo on different devices | Responsive CSS grid. Test at 768px and 1024px breakpoints minimum. |
| V12 | **No keyboard navigation / accessibility** | Fails a11y basics | Add ARIA labels to markers, keyboard focus for panels, color-blind safe palette. |
| V13 | **CDN outage (Leaflet/D3)** | App doesn't load offline | Consider bundling Leaflet + D3 locally or using `integrity` + `crossorigin` attributes with fallback. |
| V14 | **Browser compatibility** | Safari SVG rendering quirks | Test Chrome, Firefox, Safari. Avoid CSS features without webkit prefix. |

---

## 7. 🔧 IMPROVEMENTS & ADDITIONS TO CONSIDER

### Must-Have Improvements (add to build):

1. **Error Boundary & Fallback UI**
   - Graceful handling when tiles fail, JSON is missing, or a chart errors
   - Show informative error state instead of blank screen

2. **Loading States**
   - Skeleton loaders for all 5 views
   - Progress indicator during initial data load

3. **JSON Validation on Load**
   - Validate each mission has required fields before rendering
   - Console warnings for missing/malformed entries (don't crash)

4. **Offline-First Architecture**
   - Bundle Leaflet + D3 JS files locally (don't rely solely on CDN)
   - Cache-first service worker for tile layer (optional but impressive)

5. **Accessibility Basics**
   - ARIA labels on all interactive elements
   - Keyboard navigation for markers and panels
   - Color-blind safe palette (don't rely on red/green alone — add shapes or patterns)

6. **Limitations Disclosure Panel**
   - Dedicated section in the UI explaining:
     - Flat horizon model (no terrain)
     - Polar numbers are upper bounds
     - CLPS sites may have moved since data was checked
     - IM-1/IM-2 positions are post-tip, not pre-launch targets

### Nice-to-Have Improvements (if time permits):

7. **Search / Filter Bar**
   - Filter missions by provider, era, status, or latitude range
   - Instant visual feedback on map and charts

8. **Animation: Lunation Playback**
   - Animate Sun/Earth positions over one lunar day (~29.5 Earth days)
   - Play/pause control on the timeline

9. **Export / Share**
   - Export current view as PNG (html2canvas)
   - Share link with selected mission in URL hash

10. **Comparison Mode**
    - Select 2 missions side-by-side
    - Directly compare their ops windows, intervals, and sky plots

11. **Print-Friendly Summary**
    - CSS print stylesheet for judges who want a handout

12. **Performance Monitoring**
    - Track rendering time for each chart
    - Lazy-load heavy views (polar plot) only when scrolled into view

---

## 8. BUILD PROMPT — FINAL VERSION

> This is the definitive prompt. Copy and use this.

---

**Build a stunning, premium single-page web application called "Ops Window" for NASA Space Apps 2026.**

The app visualizes the **operational windows** of 22 lunar landing missions — the time periods when both the Sun and Earth are simultaneously above the horizon at each landing site, enabling both solar power and direct-to-Earth communication. The overlap of these two is the "ops window." Nobody visualizes this today.

**Three stories the app tells:**
1. Apollo (near-side equatorial) → Earth permanently up → ~1.0 efficiency (geometry was never the problem)
2. Chang'e 4 (far-side) → 0.0 direct-to-Earth time → that's why the Queqiao relay flew
3. CLPS polar (~85°S) → both bodies skim the horizon → same math, drastically harder

**All data comes from a single precomputed `missions.json` file — there is NO backend. App works offline.**

### Tech Stack:
- **HTML5** — semantic, single-page structure
- **Vanilla CSS** — dark space theme, glassmorphism panels, smooth animations, responsive
- **Vanilla JavaScript (ES6+)** — state management, event coordination between views
- **Leaflet.js** (CDN, with local fallback bundle) — lunar map with `L.CRS.EPSG4326`
- **D3.js** (CDN, with local fallback bundle) — scatter chart, timeline chart, polar sky plot
- **Tile sources (3 levels):**
  1. NASA Moon Trek WMTS (primary)
  2. USGS Astrogeology LRO LOLA/WAC mosaics (secondary)
  3. Static lunar image as `L.ImageOverlay` (emergency fallback)

### The 5 Views (build in this order):

**1. Compare Chart (D3 scatter) — BUILD FIRST, most valuable, ~60 lines**
- X: landing latitude, Y: ops efficiency (0–1)
- Dots colored by era/provider (Apollo, Chang'e, CLPS, Surveyor, etc.)
- Far-side missions sit flat at zero — this IS the visual argument
- Tooltip on hover: mission name, coordinates, efficiency
- Highlight selected mission with glow/ring
- Responsive SVG sizing

**2. Lunar Map (Leaflet)**
- Set `crs: L.CRS.EPSG4326` — NOT Web Mercator
- Lunar tiles with 3-level fallback (Moon Trek → USGS → static image)
- Sensible zoom limits for the Moon
- 22 markers colored by `metrics.ops_efficiency` (gradient: green → yellow → red)
- DON'T rely on red/green alone — add shape or size variation for color-blind safety
- Longitude conversion: `lon > 180 ? lon - 360 : lon`
- Click marker → set global `selectedMission`

**3. Mission Detail Panel**
- Slide-in panel on mission select with smooth animation
- Display ALL fields: mission name, provider, site name, lat/lon, landing date, status, ops duration, end reason, payloads, source URL, confidence
- Display computed metrics: ops efficiency (as percentage + gauge), sun hours, Earth hours, overlap hours
- Close/deselect button
- For missions where actual survival < geometry-allowed: show both numbers and highlight the gap

**4. Timeline Chart (D3 horizontal bars)**
- Horizontal time axis
- Three stacked rows per mission: sun-up (gold), Earth-up (teal), overlap (bright green)
- Each interval from JSON `[start, end]` pairs in hours → one `<rect>` per interval
- For historical missions: mark actual lander survival line vs geometry-allowed time
- The gap between survival and allowed IS the story — make it visually prominent
- Time conversion: `new Date(Date.parse(meta.analysis_window.start) + hours * 3600e3)`
- Highlight selected mission row

**5. Polar Sky Plot (D3 circular) — BUILD LAST, expendable**
- Circular SVG: compass direction around edge, elevation from horizon (rim) to zenith (center)
- Draw Sun's path (gold line) and Earth's path (teal line) over one lunation
- Apollo 11: both arc high overhead; 85°S: both crawl near the rim
- Uses `tracks` array from JSON
- Drop this entirely if running short — the project works without it

### Design Requirements:
- **Dark space theme** — deep navy (#0a0e27) to black backgrounds
- **Glassmorphism** panels — `backdrop-filter: blur()`, subtle borders, transparency
- Premium typography — Google Fonts: **Space Grotesk** for headings, **Inter** for body
- Color palette: deep space blues, nebula purples (#7c3aed), solar golds (#f59e0b), Earth teals (#14b8a6)
- Smooth micro-animations: hover effects, panel slide-ins, chart transitions (200–300ms ease)
- "Mission control" aesthetic — think NASA JPL dashboards
- Fully responsive: desktop (1440px), tablet (768px), mobile-aware (480px)

### State Management:
- Single global `selectedMission` variable/state
- **All 5 views listen** to selection changes and update accordingly
- Use custom events or a simple pub/sub pattern
- Clicking a dot on the scatter chart, a marker on the map, or a row on the timeline ALL set the same state

### Error Handling & Resilience:
- Try/catch around JSON fetch with user-friendly error state
- Validate mission JSON entries on load (warn on missing fields, don't crash)
- Tile load error → automatically try next fallback level
- Skeleton loaders for all views during initial render
- Console warnings for data issues (wrong signs, missing coords)

### Accessibility:
- ARIA labels on markers, chart elements, and panel controls
- Keyboard navigation (Tab through missions, Enter to select)
- Color-blind safe: don't rely solely on red/green — add shapes, patterns, or size encoding

### Limitations Disclosure (show in footer or info panel):
- "Horizons treats the horizon as flat. Real terrain is not modeled."
- "At 85°S, terrain genuinely decides visibility. Polar numbers are upper bounds."
- "CLPS target sites may have shifted since data was last verified."
- "IM-1 and IM-2 positions are post-landing (both tipped over), not pre-launch targets."

### Data Schema:
```json
{
  "mission_id": "apollo-11",
  "mission": "Apollo 11",
  "provider": "NASA",
  "site_name": "Mare Tranquillitatis",
  "lat_deg": 0.6875,
  "lon_east_deg": 23.4333,
  "landing_utc": "1969-07-20T20:17:40Z",
  "status": "success",
  "ops_duration": "8 days",
  "end_reason": "Planned return",
  "payloads": ["EASEP", "Laser retroreflector"],
  "source_url": "https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo_land.html",
  "confidence": "confirmed",
  "metrics": {
    "ops_efficiency": 0.98,
    "sun_hours": 354,
    "earth_hours": 720,
    "overlap_hours": 354
  },
  "intervals": {
    "sun": [[0, 354], [708, 1062]],
    "earth": [[0, 720]],
    "overlap": [[0, 354]]
  },
  "tracks": {
    "sun": [{"az": 90, "el": 45}, {"az": 100, "el": 50}],
    "earth": [{"az": 0, "el": 60}, {"az": 5, "el": 58}]
  },
  "analysis_window": {
    "start": "2025-01-01T00:00:00Z",
    "end": "2026-01-01T00:00:00Z"
  }
}
```

Include mock data for 5 missions: Apollo 11 (~1.0), Apollo 15 (~0.95), Chang'e 4 (0.0), IM-1 Odysseus (~0.4, partial), and a planned CLPS polar at ~85°S (~0.15).

---

## 9. ✅ MASTER BUILD CHECKLIST

### Phase 0 — Foundation
- [ ] Create project folder structure: `index.html`, `styles.css`, `app.js`, `data/missions.json`
- [ ] Set up HTML shell with semantic structure (`<header>`, `<main>`, `<section>`, `<footer>`)
- [ ] Import Google Fonts (Space Grotesk + Inter)
- [ ] Import Leaflet CSS/JS from CDN
- [ ] Import D3.js from CDN
- [ ] Create CSS design system: custom properties, dark theme, glassmorphism utilities, layout grid
- [ ] Create mock `missions.json` with 5 sample missions (Apollo 11, Apollo 15, Chang'e 4, IM-1, CLPS polar)
- [ ] Implement global state management (`selectedMission` + pub/sub events)

### Phase 1 — Compare Chart (D3) ⭐ BUILD FIRST
- [ ] Create scatter plot container with glassmorphism panel
- [ ] Build D3 scatter: X = latitude, Y = ops efficiency
- [ ] Color dots by provider/era with legend
- [ ] Add axes with labels ("Landing Latitude °" / "Ops Efficiency")
- [ ] Add tooltips on hover (mission name, coords, efficiency)
- [ ] Click dot → set global `selectedMission`
- [ ] Highlight selected dot (glow/ring effect)
- [ ] Responsive SVG sizing (resize listener)
- [ ] Add color-blind safe encoding (shape or size variation alongside color)

### Phase 2 — Lunar Map (Leaflet)
- [ ] Initialize map with `crs: L.CRS.EPSG4326` (NOT Web Mercator)
- [ ] Load NASA Moon Trek WMTS tiles
- [ ] Implement tile error detection → auto-fallback to USGS
- [ ] Implement final fallback to static `ImageOverlay`
- [ ] Set sensible zoom limits for lunar scale
- [ ] Add 22 markers from JSON, colored by `ops_efficiency`
- [ ] Apply longitude conversion: `lon > 180 ? lon - 360 : lon`
- [ ] Click marker → set global `selectedMission`
- [ ] Highlight selected marker (pulsing ring / size change)
- [ ] Style map container with glassmorphism panel
- [ ] Add ARIA labels to markers

### Phase 3 — Mission Detail Panel
- [ ] Create slide-in panel component (right side or overlay)
- [ ] Display all mission metadata: name, provider, site, coords, date, status, duration, end reason, payloads
- [ ] Display `source_url` as clickable link
- [ ] Display `confidence` badge (confirmed = green, verify = amber)
- [ ] Display computed metrics with visual gauges: ops efficiency %, sun hours, Earth hours, overlap hours
- [ ] For historical missions: show actual survival vs geometry-allowed (highlight the gap)
- [ ] Close button / click-outside to deselect
- [ ] Smooth slide-in/out animation (300ms ease)
- [ ] Panel listens to global `selectedMission` state
- [ ] Keyboard: Escape to close

### Phase 4 — Timeline Chart (D3)
- [ ] Create horizontal time axis
- [ ] Three stacked rows per mission: sun (gold), Earth (teal), overlap (green)
- [ ] Render `[start, end]` pairs as `<rect>` SVG elements
- [ ] Time conversion from hours to Date objects
- [ ] For historical missions: mark actual lander survival line overlay
- [ ] Visually emphasize the gap (survival vs allowed) — this IS the story
- [ ] Click mission row → set global `selectedMission`
- [ ] Highlight selected mission row
- [ ] Scrollable if many missions
- [ ] Responsive width

### Phase 5 — Polar Sky Plot (D3) — BUILD LAST, EXPENDABLE
- [ ] Circular SVG with compass directions (N, E, S, W labels)
- [ ] Concentric elevation rings (0° horizon at rim → 90° zenith at center)
- [ ] Draw Sun path (gold) from `tracks.sun` data
- [ ] Draw Earth path (teal) from `tracks.earth` data
- [ ] Update on mission selection
- [ ] Label paths clearly
- [ ] **Skip entirely if running short — project works without it**

### Phase 6 — Error Handling & Resilience
- [ ] Try/catch around `fetch('data/missions.json')`
- [ ] User-friendly error state (not blank screen)
- [ ] Validate JSON: check each mission for required fields
- [ ] Console warnings for data issues (no crashes)
- [ ] Skeleton loaders / spinners for all 5 views during initial render
- [ ] Tile load error event → trigger next fallback level
- [ ] Handle empty state: "No mission selected — click a marker to explore"

### Phase 7 — Accessibility & Polish
- [ ] ARIA labels on all interactive elements (markers, dots, panel controls)
- [ ] Keyboard navigation: Tab through missions, Enter to select, Escape to close panel
- [ ] Color-blind safe palette (shapes + colors, not color alone)
- [ ] Add limitations disclosure section in UI footer or info modal
- [ ] SEO meta tags: `<title>`, `<meta description>`, OG tags
- [ ] Single `<h1>` with proper heading hierarchy
- [ ] Responsive layout tested at 1440px, 1024px, 768px, 480px
- [ ] Smooth transitions between all selections (200–300ms ease)
- [ ] Performance: no layout jank, charts render under 500ms
- [ ] Cross-browser: Chrome, Firefox, Safari

### Phase 8 — Real Data Integration (When Person 2 Delivers)
- [ ] Replace mock `missions.json` with Person 2's precomputed file
- [ ] Verify all 22 missions render on map, chart, timeline
- [ ] Sanity checks: Apollo 11 ≈ 1.0, Chang'e 4 = 0.0
- [ ] Sanity checks: far-side = zero Earth time, ops ≤ min(sun, earth)
- [ ] Check no longitude sign errors (markers on correct side of Moon)
- [ ] Spot-check 3 missions on lunar map for position accuracy
- [ ] Final visual QA pass across all views
- [ ] Demo rehearsal

---

## 10. DEPENDENCY CHAIN & DEADLINES

```
Person 1 (Mission Research) ──→ Person 2 (Data Pipeline) ──→ Schema Freeze
                                                                    │
                                                          ┌────────┴────────┐
                                                          ▼                 ▼
                                                    Person 4            Person 5
                                                   (Map + Panel)    (Charts × 3)
                                                          │                 │
                                                          └────────┬────────┘
                                                                   ▼
                                                            Integration
                                                                   │
                                                                   ▼
                                                             Person 6
                                                             (Slides)
```

| Person | Pre-event Task | Deadline | Blocks |
|--------|---------------|----------|--------|
| 1 | Verified coordinates + mission facts for 22 sites | Early November | Person 2, and through them everyone |
| 2 | Run precompute, validate, freeze `missions.json` | Early November | Persons 4 and 5 |
| 4 | Confirm lunar tile source loads in a browser | **This week** | Nothing, but a late failure is expensive |
| 5 | Hand-written mock JSON, build compare chart | Optional, recommended | Nothing |

---

> **This document is the single source of truth for the Ops Window build.** Update the checklist as work progresses.
