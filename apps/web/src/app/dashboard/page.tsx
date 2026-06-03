'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useSite } from '@/components/site-context';
import DashboardHeader from '@/components/dashboard-header';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
// Or we can just write a fast interpolation function ourselves to avoid dependencies! A simple hex color interpolator is very robust.
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { Activity, Eye, Laptop, Globe, Loader2, Link2 } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// TopoJSON world map file URL
const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Simple custom color interpolator for the heatmap to avoid extra npm packages
function getHeatmapColor(count: number, max: number) {
  if (count === 0) return '#171717'; // neutral-900
  const ratio = max > 0 ? count / max : 0;
  // Interpolating between HSL(250, 20%, 15%) and HSL(250, 85%, 65%)
  const lightness = Math.round(15 + ratio * (65 - 15));
  const saturation = Math.round(20 + ratio * (85 - 20));
  return `hsl(250, ${saturation}%, ${lightness}%)`;
}

export default function OverviewPage() {
  const { activeSite } = useSite();
  const [mounted, setMounted] = useState(false);

  // Mount check to avoid hydration issues with Recharts
  useEffect(() => {
    setMounted(true);
  }, []);

  const { data, error, isLoading } = useSWR(
    activeSite ? `/api/metrics?siteId=${activeSite.id}` : null,
    fetcher
  );

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!activeSite) {
    return (
      <>
        <DashboardHeader title="Analytics Overview" />
        <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] text-center px-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-900 border border-neutral-850 text-neutral-400 mb-6">
            <Globe className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-neutral-200">No Websites Registered</h2>
          <p className="text-neutral-400 text-sm max-w-sm mt-2 mb-6">
            Register your domain first to start collecting privacy-friendly website analytics.
          </p>
        </div>
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <DashboardHeader title="Analytics Overview" />
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </>
    );
  }

  if (error || !data || data.noSites) {
    return (
      <>
        <DashboardHeader title="Analytics Overview" />
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center text-neutral-400 text-sm">
          Failed to load metrics data.
        </div>
      </>
    );
  }

  const { metrics, history, topPages, devices, countries } = data;

  // Find max country count for color scaling
  const maxCountryCount = countries.length > 0 ? Math.max(...countries.map((c: any) => c.count)) : 0;

  // Format devices for Pie Chart
  const pieColors = ['#818cf8', '#34d399', '#f472b6', '#fbbf24', '#a78bfa'];
  const deviceData = devices.map((d: any) => ({
    name: d.device.charAt(0).toUpperCase() + d.device.slice(1),
    value: parseInt(d.count, 10),
  }));

  return (
    <>
      <DashboardHeader title="Analytics Overview" />

      <div className="p-6 md:p-8 lg:p-10 space-y-8 max-w-7xl mx-auto">
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Pageviews */}
          <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-6 flex items-center justify-between shadow-sm">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Pageviews Today</p>
              <h3 className="text-3xl font-extrabold text-neutral-100">{metrics.pageviewsToday}</h3>
            </div>
            <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Eye className="h-6 w-6" />
            </div>
          </div>

          {/* Card 2: Unique Pages */}
          <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-6 flex items-center justify-between shadow-sm">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Unique Pages</p>
              <h3 className="text-3xl font-extrabold text-neutral-100">{metrics.uniquePages}</h3>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Globe className="h-6 w-6" />
            </div>
          </div>

          {/* Card 3: Top Referrer */}
          <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-6 flex items-center justify-between shadow-sm">
            <div className="space-y-1 min-w-0 flex-1 pr-4">
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Top Referrer</p>
              <h3 className="text-xl font-bold text-neutral-100 truncate">{metrics.topReferrer}</h3>
            </div>
            <div className="h-12 w-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 shrink-0">
              <Link2 className="h-6 w-6" />
            </div>
          </div>

          {/* Card 4: Top Device */}
          <div className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-6 flex items-center justify-between shadow-sm">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Top Device</p>
              <h3 className="text-xl font-bold text-neutral-100 capitalize">{metrics.topDevice}</h3>
            </div>
            <div className="h-12 w-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <Laptop className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* 30 Day Trend Line Chart */}
        <div className="rounded-2xl border border-neutral-900 bg-neutral-900/20 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-sm font-bold text-neutral-200">Pageview History</h4>
              <p className="text-xs text-neutral-400">Daily website traffic trends over the last 30 days</p>
            </div>
          </div>
          <div className="h-80 w-full">
            {history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(250, 85%, 65%)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="hsl(250, 85%, 65%)" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#404040" fontSize={10} tickLine={false} />
                  <YAxis stroke="#404040" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '12px' }}
                    labelStyle={{ color: '#a3a3a3', fontSize: '11px', fontWeight: 'bold' }}
                    itemStyle={{ color: '#f5f5f5', fontSize: '12px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="views"
                    stroke="hsl(250, 85%, 65%)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorViews)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-neutral-500">
                No traffic data recorded in this period.
              </div>
            )}
          </div>
        </div>

        {/* Secondary Charts: Top Pages & Device Split */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Top Pages (last 7 days) */}
          <div className="rounded-2xl border border-neutral-900 bg-neutral-900/20 p-6 shadow-sm lg:col-span-2">
            <h4 className="text-sm font-bold text-neutral-200 mb-6">Top Pages (Last 7 Days)</h4>
            <div className="h-64 w-full">
              {topPages.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topPages} layout="vertical" margin={{ top: 0, right: 10, left: 30, bottom: 0 }}>
                    <XAxis type="number" stroke="#404040" fontSize={10} tickLine={false} />
                    <YAxis dataKey="page" type="category" stroke="#404040" fontSize={10} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '12px' }}
                      itemStyle={{ color: '#f5f5f5', fontSize: '12px' }}
                    />
                    <Bar dataKey="views" fill="hsl(250, 85%, 65%)" radius={[0, 4, 4, 0]}>
                      {topPages.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? 'hsl(250, 85%, 65%)' : '#4f46e5'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-neutral-500">
                  No pages tracked.
                </div>
              )}
            </div>
          </div>

          {/* Device Split (Doughnut) */}
          <div className="rounded-2xl border border-neutral-900 bg-neutral-900/20 p-6 shadow-sm flex flex-col justify-between">
            <h4 className="text-sm font-bold text-neutral-200 mb-4">Device Segmentation</h4>
            <div className="h-44 w-full relative flex items-center justify-center">
              {deviceData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={deviceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {deviceData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-neutral-500">
                  No devices recorded.
                </div>
              )}
            </div>
            {/* Legend */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              {deviceData.map((d: any, index: number) => (
                <div key={d.name} className="flex items-center gap-2 text-xs font-semibold text-neutral-400">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: pieColors[index % pieColors.length] }}
                  />
                  <span className="truncate">{d.name} ({d.value})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Visitor Country Heatmap */}
        <div className="rounded-2xl border border-neutral-900 bg-neutral-900/20 p-6 shadow-sm">
          <div>
            <h4 className="text-sm font-bold text-neutral-200">Visitor Country Heatmap</h4>
            <p className="text-xs text-neutral-400 mb-6">Density of visitor traffic mapped by geographical location</p>
          </div>
          <div className="flex flex-col md:flex-row gap-8 items-center">
            <div className="w-full md:w-2/3 max-h-96">
              <ComposableMap projectionConfig={{ rotate: [-10, 0, 0], scale: 125 }}>
                <Geographies geography={geoUrl}>
                  {({ geographies }) =>
                    geographies.map((geo) => {
                      const countryCode = geo.properties.ISO_A2 || geo.properties.iso_a2;
                      const record = countries.find((c: any) => c.country === countryCode);
                      const count = record ? parseInt(record.count, 10) : 0;
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={getHeatmapColor(count, maxCountryCount)}
                          stroke="#262626"
                          strokeWidth={0.5}
                          style={{
                            default: { outline: 'none' },
                            hover: { fill: 'hsl(250, 85%, 65%)', outline: 'none', transition: 'all 0.1s' },
                            pressed: { outline: 'none' },
                          }}
                        />
                      );
                    })
                  }
                </Geographies>
              </ComposableMap>
            </div>
            {/* Heatmap statistics list */}
            <div className="w-full md:w-1/3 space-y-4 shrink-0">
              <h5 className="text-xs font-bold text-neutral-300 uppercase tracking-wider border-b border-neutral-900 pb-2">Top Countries</h5>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                {countries.length > 0 ? (
                  countries.map((c: any, index: number) => (
                    <div key={c.country} className="flex items-center justify-between text-xs py-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-neutral-400 w-5">{index + 1}.</span>
                        <span className="font-bold text-neutral-200">{c.country}</span>
                      </div>
                      <span className="font-semibold text-neutral-400">{c.count} views</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-neutral-500 py-2">No country data collected yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
