"use client";

import { useEffect, useRef } from 'react';
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

  useEffect(() => {
    if (!missions || missions.length === 0 || !chartRef.current) return;

    // Clear previous
    d3.select(chartRef.current).selectAll('*').remove();

    const rect = chartRef.current.getBoundingClientRect();
    const margin = { top: 20, right: 30, bottom: 50, left: 55 };
    const width = rect.width - margin.left - margin.right;
    const height = 280 - margin.top - margin.bottom;

    const svg = d3.select(chartRef.current)
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
    // Remove old tooltip if exists
    d3.select('body').selectAll('.chart-tooltip-compare').remove();
    const tooltip = d3.select('body').append('div')
      .attr('class', 'chart-tooltip chart-tooltip-compare');

    // Dots
    const dots = g.selectAll('.compare-dot')
      .data(missions)
      .enter()
      .append('circle')
      .attr('class', 'compare-dot')
      .attr('cx', d => x(d.lat_deg))
      .attr('cy', d => y(d.metrics.ops_efficiency))
      .attr('r', 8)
      .attr('fill', d => PROVIDER_COLORS[d.provider] || PROVIDER_COLORS['default'])
      .style('cursor', 'pointer')
      .style('transition', 'r 150ms ease')
      .style('stroke-width', 2)
      .style('stroke', 'transparent')
      .on('mouseenter', function (event, d) {
        d3.select(this)
          .style('stroke', 'var(--text-primary)')
          .style('filter', 'brightness(1.3)');

        tooltip
          .html(`
            <div class="tt-title">${d.mission}</div>
            <div class="tt-row"><span>Provider</span><span class="tt-val">${d.provider}</span></div>
            <div class="tt-row"><span>Latitude</span><span class="tt-val">${d.lat_deg.toFixed(2)}°</span></div>
            <div class="tt-row"><span>Ops Efficiency</span><span class="tt-val">${(d.metrics.ops_efficiency * 100).toFixed(1)}%</span></div>
            <div class="tt-row"><span>Status</span><span class="tt-val">${d.status}</span></div>
          `)
          .style('left', (event.pageX + 12) + 'px')
          .style('top', (event.pageY - 10) + 'px')
          .classed('visible', true);
      })
      .on('mousemove', function (event) {
        tooltip
          .style('left', (event.pageX + 12) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseleave', function () {
        const isSelected = d3.select(this).classed('selected');
        if (!isSelected) {
          d3.select(this)
            .style('stroke', 'transparent')
            .style('filter', 'none');
        }
        tooltip.classed('visible', false);
      })
      .on('click', function (event, d) {
        if (onSelect) onSelect(d.mission_id);
      });

    // Animate dots in
    dots
      .attr('r', 0)
      .transition()
      .duration(600)
      .delay((d, i) => i * 100)
      .attr('r', 8)
      .ease(d3.easeCubicOut);

    return () => {
      d3.select('body').selectAll('.chart-tooltip-compare').remove();
    };

  }, [missions, onSelect]);

  // Handle selection changes
  useEffect(() => {
    if (!chartRef.current) return;
    
    const svg = d3.select(chartRef.current);
    
    svg.selectAll('.compare-dot').each(function(d) {
      const isSelected = d.mission_id === selectedId;
      const el = d3.select(this);
      
      el.classed('selected', isSelected);
      
      if (isSelected) {
        el.style('stroke', 'var(--text-primary)')
          .style('stroke-width', 3)
          .style('filter', 'drop-shadow(0 0 8px currentColor)');
      } else {
        el.style('stroke', 'transparent')
          .style('stroke-width', 2)
          .style('filter', 'none');
      }
    });
  }, [selectedId]);

  // Extract unique providers for legend
  const providers = missions ? [...new Set(missions.map(m => m.provider))] : [];

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div ref={chartRef} style={{ width: '100%', height: 280 }} />
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        padding: '8px 16px',
        justifyContent: 'center',
        marginTop: '8px'
      }}>
        {providers.map(p => (
          <div key={p} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.72rem',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)'
          }}>
            <div style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: PROVIDER_COLORS[p] || PROVIDER_COLORS['default']
            }} />
            {p}
          </div>
        ))}
      </div>
    </div>
  );
}
