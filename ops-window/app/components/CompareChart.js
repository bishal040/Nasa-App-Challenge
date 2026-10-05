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

    d3.select(chartRef.current).selectAll('*').remove();

    const rect = chartRef.current.getBoundingClientRect();
    const margin = { top: 20, right: 30, bottom: 40, left: 40 };
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
      .call(d3.axisBottom(x).ticks(5).tickFormat(d => `${d}°`))
      .attr('color', 'rgba(255,255,255,0.4)');

    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${(d * 100).toFixed(0)}%`))
      .attr('color', 'rgba(255,255,255,0.4)');

    // Axis labels
    svg.append('text')
      .attr('x', margin.left + width / 2)
      .attr('y', rect.height - 5)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(255,255,255,0.4)')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .text('Landing Latitude');

    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -(margin.top + height / 2))
      .attr('y', 10)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(255,255,255,0.4)')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .text('Efficiency');

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
      .style('font-size', '11px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', 1000);

    const dots = g.selectAll('.compare-dot')
      .data(missions)
      .enter()
      .append('circle')
      .attr('class', 'compare-dot')
      .attr('cx', d => x(d.lat_deg))
      // Use dynamic opsEfficiencyRaw from computedMetrics
      .attr('cy', d => y(d.computedMetrics ? d.computedMetrics.opsEfficiencyRaw : 0))
      .attr('r', 6)
      .attr('fill', d => PROVIDER_COLORS[d.provider] || PROVIDER_COLORS['default'])
      .style('cursor', 'pointer')
      .style('stroke-width', 2)
      .style('stroke', 'transparent')
      .on('mouseenter', function (event, d) {
        d3.select(this).style('stroke', '#fff').attr('r', 8);
        const eff = d.computedMetrics ? (d.computedMetrics.opsEfficiencyRaw * 100).toFixed(1) : 0;
        tooltip
          .html(`<strong style="font-family:sans-serif">${d.mission}</strong><br/>Lat: ${d.lat_deg.toFixed(1)}°<br/>Eff: ${eff}%`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px')
          .style('opacity', 1);
      })
      .on('mouseleave', function () {
        const isSelected = d3.select(this).classed('selected');
        if (!isSelected) d3.select(this).style('stroke', 'transparent').attr('r', 6);
        tooltip.style('opacity', 0);
      })
      .on('click', function (event, d) {
        if (onSelect) onSelect(d.mission_id);
      });

    return () => {
      d3.select('body').selectAll('.chart-tooltip-compare').remove();
    };

  }, [missions, onSelect]);

  useEffect(() => {
    if (!chartRef.current) return;
    d3.select(chartRef.current).selectAll('.compare-dot').each(function(d) {
      const isSelected = d.mission_id === selectedId;
      const el = d3.select(this);
      el.classed('selected', isSelected);
      if (isSelected) {
        el.style('stroke', '#fff').attr('r', 8);
      } else {
        el.style('stroke', 'transparent').attr('r', 6);
      }
    });
  }, [selectedId]);

  return <div ref={chartRef} style={{ width: '100%', height: '100%' }} />;
}
