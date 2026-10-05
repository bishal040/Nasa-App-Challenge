"use client";

import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';

const PROVIDER_COLORS = {
  'NASA': '#3b82f6',
  'CNSA': '#ef4444',
  'ISRO': '#f59e0b',
  'Intuitive Machines': '#a855f7',
  'Firefly': '#f97316',
  'NASA / CLPS': '#06b6d4',
  'JAXA': '#ec4899',
  'ispace': '#8b5cf6',
  'default': '#6b7280'
};

export default function CompareChart({ missions, selectedId, onSelect }) {
  const chartRef = useRef(null);
  const resizeTimerRef = useRef(null);

  // Extract stable mission properties to prevent full re-renders on every simulation tick
  const stableMissions = useMemo(() => {
    if (!missions) return [];
    return missions.map(m => ({
      mission_id: m.mission_id,
      mission: m.mission,
      lat_deg: m.lat_deg,
      provider: m.provider
    }));
  }, [missions?.length]);

  // 1. Static Layout & Axes - Only runs on mount or resize
  useEffect(() => {
    if (!chartRef.current || stableMissions.length === 0) return;

    // Create a single global tooltip if it doesn't exist to prevent DOM thrashing
    d3.select('body').selectAll('.chart-tooltip-compare').remove();
    const tooltip = d3.select('body').append('div')
      .attr('class', 'chart-tooltip-compare')
      .style('position', 'absolute')
      .style('background', 'rgba(5,7,10,0.95)')
      .style('border', '1px solid rgba(255,255,255,0.1)')
      .style('border-radius', '8px')
      .style('padding', '8px 12px')
      .style('color', '#fff')
      .style('font-family', 'monospace')
      .style('font-size', '13px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', 1000)
      .style('box-shadow', '0 4px 12px rgba(0,0,0,0.5)');

    const renderChart = () => {
      d3.select(chartRef.current).selectAll('svg').remove();

      const rect = chartRef.current.parentElement.getBoundingClientRect();
      const isLarge = rect.height > 300; 
      
      const margin = { top: 20, right: 30, bottom: isLarge ? 50 : 40, left: isLarge ? 60 : 40 };
      const width = rect.width - margin.left - margin.right;
      const height = rect.height - margin.top - margin.bottom;

      const svg = d3.select(chartRef.current)
        .append('svg')
        .attr('width', rect.width)
        .attr('height', rect.height)
        .attr('role', 'img');

      const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const x = d3.scaleLinear().domain([-90, 90]).range([0, width]);
      const y = d3.scaleLinear().domain([0, 1.05]).range([height, 0]);

      // Grid
      g.append('g')
        .attr('class', 'chart-grid')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).tickSize(-height).tickFormat(''))
        .attr('color', 'rgba(255,255,255,0.05)');

      g.append('g')
        .attr('class', 'chart-grid')
        .call(d3.axisLeft(y).tickSize(-width).tickFormat(''))
        .attr('color', 'rgba(255,255,255,0.05)');

      // Axes
      g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(isLarge ? 9 : 5).tickFormat(d => `${d}°`))
        .attr('color', 'rgba(255,255,255,0.4)')
        .selectAll('text')
        .attr('font-size', isLarge ? '14px' : '13px');

      g.append('g')
        .call(d3.axisLeft(y).ticks(isLarge ? 10 : 5).tickFormat(d => `${(d * 100).toFixed(0)}%`))
        .attr('color', 'rgba(255,255,255,0.4)')
        .selectAll('text')
        .attr('font-size', isLarge ? '14px' : '13px');

      // Axis labels
      svg.append('text')
        .attr('x', margin.left + width / 2)
        .attr('y', rect.height - 5)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(255,255,255,0.4)')
        .attr('font-size', isLarge ? '16px' : '13px')
        .attr('font-family', 'monospace')
        .text('Landing Latitude');

      svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -(margin.top + height / 2))
        .attr('y', isLarge ? 20 : 10)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(255,255,255,0.4)')
        .attr('font-size', isLarge ? '16px' : '13px')
        .attr('font-family', 'monospace')
        .text('Efficiency');

      // Static Dots (CY positions injected by effect #2)
      g.selectAll('.compare-dot')
        .data(stableMissions)
        .enter()
        .append('circle')
        .attr('class', 'compare-dot')
        .attr('data-id', d => d.mission_id)
        .attr('cx', d => x(d.lat_deg))
        .attr('cy', height) // Default bottom, updated instantly by effect
        .attr('r', isLarge ? 8 : 6)
        .attr('fill', d => PROVIDER_COLORS[d.provider] || PROVIDER_COLORS['default'])
        .style('cursor', 'pointer')
        .style('stroke-width', 2)
        .style('stroke', 'transparent')
        .style('transition', 'r 0.2s ease, stroke 0.2s ease')
        .on('mouseenter', function (event, d) {
          d3.select(this).style('stroke', '#fff').attr('r', isLarge ? 12 : 8);
          tooltip.attr('data-active-id', d.mission_id); // Tag tooltip for dynamic updates
          // Initial content
          const eff = d3.select(this).attr('data-eff') || '0.0';
          tooltip
            .html(`<strong style="font-family:sans-serif">${d.mission}</strong><br/>Lat: ${d.lat_deg.toFixed(1)}°<br/>Eff: <span class="live-eff">${eff}</span>%<br/><span style="color:${PROVIDER_COLORS[d.provider] || '#ccc'}">${d.provider}</span>`)
            .style('left', (event.pageX + 15) + 'px')
            .style('top', (event.pageY - 15) + 'px')
            .style('opacity', 1);
        })
        .on('mouseleave', function () {
          const isSelected = d3.select(this).classed('selected');
          if (!isSelected) d3.select(this).style('stroke', 'transparent').attr('r', isLarge ? 8 : 6);
          tooltip.style('opacity', 0).attr('data-active-id', null);
        })
        .on('click', function (event, d) {
          if (onSelect) onSelect(d.mission_id);
        });
    };

    renderChart();

    const observer = new ResizeObserver(() => {
        clearTimeout(resizeTimerRef.current);
        resizeTimerRef.current = setTimeout(() => {
            renderChart();
        }, 200);
    });
    observer.observe(chartRef.current.parentElement);

    return () => {
        observer.disconnect();
        clearTimeout(resizeTimerRef.current);
    };
  }, [stableMissions, onSelect]);

  // 2. Dynamic Live Updates - Updates CY positions on every simulation tick WITHOUT touching DOM
  useEffect(() => {
    if (!chartRef.current || !missions) return;
    
    const rect = chartRef.current.parentElement.getBoundingClientRect();
    const isLarge = rect.height > 300;
    const margin = { top: 20, right: 30, bottom: isLarge ? 50 : 40, left: isLarge ? 60 : 40 };
    const height = rect.height - margin.top - margin.bottom;
    const y = d3.scaleLinear().domain([0, 1.05]).range([height, 0]);

    d3.select(chartRef.current).selectAll('.compare-dot').each(function() {
      const el = d3.select(this);
      const id = el.attr('data-id');
      const mission = missions.find(m => m.mission_id === id);
      if (mission && mission.computedMetrics) {
        const rawEff = mission.computedMetrics.opsEfficiencyRaw;
        const formattedEff = (rawEff * 100).toFixed(1);
        el.attr('cy', y(rawEff));
        el.attr('data-eff', formattedEff);
      }
    });

    // Update tooltip live text if visible
    const tooltip = d3.select('body').select('.chart-tooltip-compare');
    if (tooltip.node() && tooltip.style('opacity') === '1') {
      const activeId = tooltip.attr('data-active-id');
      const mission = missions.find(m => m.mission_id === activeId);
      if (mission && mission.computedMetrics) {
        tooltip.select('.live-eff').text((mission.computedMetrics.opsEfficiencyRaw * 100).toFixed(1));
      }
    }
  }, [missions]);

  // 3. Selection Updates
  useEffect(() => {
    if (!chartRef.current) return;
    const rect = chartRef.current.parentElement.getBoundingClientRect();
    const isLarge = rect.height > 300;
    
    d3.select(chartRef.current).selectAll('.compare-dot').each(function() {
      const el = d3.select(this);
      const id = el.attr('data-id');
      const isSelected = id === selectedId;
      el.classed('selected', isSelected);
      if (isSelected) {
        el.style('stroke', '#fff').attr('r', isLarge ? 12 : 8);
      } else {
        el.style('stroke', 'transparent').attr('r', isLarge ? 8 : 6);
      }
    });
  }, [selectedId]);

  // Clean up tooltip when component entirely unmounts
  useEffect(() => {
    return () => d3.select('body').selectAll('.chart-tooltip-compare').remove();
  }, []);

  return <div ref={chartRef} style={{ width: '100%', height: '100%' }} />;
}
