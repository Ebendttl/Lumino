'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useSite } from '@/components/site-context';
import DashboardHeader from '@/components/dashboard-header';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import { GitMerge, Loader2, Plus, Trash2, ArrowDown } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function FunnelsPage() {
  const { activeSite } = useSite();
  const [mounted, setMounted] = useState(false);
  const [funnelName, setFunnelName] = useState('');
  const [steps, setSteps] = useState<string[]>(['/', '/pricing']);
  const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch list of funnels
  const { data: funnels = [], mutate: mutateFunnels, isLoading: funnelsLoading } = useSWR(
    mounted ? '/api/funnels' : null,
    fetcher
  );

  // Fetch data for the active funnel
  const { data: funnelData, isLoading: funnelDataLoading } = useSWR(
    selectedFunnelId && activeSite
      ? `/api/funnels/${selectedFunnelId}?siteId=${activeSite.id}`
      : null,
    fetcher
  );

  useEffect(() => {
    if (funnels.length > 0 && !selectedFunnelId) {
      setSelectedFunnelId(funnels[0].id);
    }
  }, [funnels, selectedFunnelId]);

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleAddStepField = () => {
    if (steps.length < 5) {
      setSteps([...steps, '']);
    }
  };

  const handleRemoveStepField = (index: number) => {
    if (steps.length > 2) {
      const copy = [...steps];
      copy.splice(index, 1);
      setSteps(copy);
    }
  };

  const handleStepChange = (index: number, val: string) => {
    const copy = [...steps];
    copy[index] = val;
    setSteps(copy);
  };

  const handleCreateFunnel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!funnelName || steps.some(s => !s.trim())) return;
    setFormLoading(true);

    try {
      const res = await fetch('/api/funnels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: funnelName, steps }),
      });

      if (res.ok) {
        const data = await res.json();
        setFunnelName('');
        setSteps(['/', '/pricing']);
        mutateFunnels();
        setSelectedFunnelId(data.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFormLoading(false);
    }
  };

  const selectedFunnel = funnels.find((f: any) => f.id === selectedFunnelId);

  return (
    <>
      <DashboardHeader title="Conversion Funnels" />

      <div className="p-6 md:p-8 lg:p-10 space-y-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Funnel Creator & Select List */}
          <div className="space-y-6 lg:col-span-1">
            {/* Create Funnel Card */}
            <div className="rounded-2xl border border-neutral-900 bg-neutral-900/20 p-6 space-y-4">
              <h3 className="text-sm font-bold text-neutral-200">Create New Funnel</h3>
              <form onSubmit={handleCreateFunnel} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="funnel-name" className="text-xs font-semibold text-neutral-400">Funnel Name</label>
                  <input
                    id="funnel-name"
                    type="text"
                    required
                    value={funnelName}
                    onChange={(e) => setFunnelName(e.target.value)}
                    placeholder="e.g. Purchase Flow"
                    className="block w-full px-3 py-2 bg-neutral-950 border border-neutral-850 rounded-xl text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>

                <div className="space-y-2.5">
                  <span className="text-xs font-semibold text-neutral-400 block">Steps (ordered page paths)</span>
                  {steps.map((step, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <span className="text-xs text-neutral-500 font-bold w-4">{idx + 1}.</span>
                      <input
                        type="text"
                        required
                        value={step}
                        onChange={(e) => handleStepChange(idx, e.target.value)}
                        placeholder="e.g. /pricing"
                        className="flex-1 block px-3 py-1.5 bg-neutral-950 border border-neutral-850 rounded-xl text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      />
                      {steps.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveStepField(idx)}
                          className="p-1.5 border border-neutral-850 hover:bg-neutral-850 rounded-lg text-neutral-400 hover:text-neutral-200 transition duration-150"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {steps.length < 5 && (
                    <button
                      type="button"
                      onClick={handleAddStepField}
                      className="flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary/90 mt-1 pl-6"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Step</span>
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={formLoading || !activeSite}
                  className="w-full flex justify-center py-2 px-4 border border-transparent text-xs font-bold rounded-xl text-white bg-primary hover:bg-primary/95 shadow-md shadow-primary/20 disabled:opacity-50 transition duration-150"
                >
                  Create Funnel
                </button>
              </form>
            </div>

            {/* List of Funnels */}
            <div className="rounded-2xl border border-neutral-900 bg-neutral-900/20 p-6 space-y-4">
              <h3 className="text-sm font-bold text-neutral-200">Funnels</h3>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {funnelsLoading ? (
                  <div className="text-xs text-neutral-500 py-2">Loading funnels...</div>
                ) : funnels.length > 0 ? (
                  funnels.map((f: any) => (
                    <button
                      key={f.id}
                      onClick={() => setSelectedFunnelId(f.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition duration-150 ${
                        selectedFunnelId === f.id
                          ? 'bg-neutral-900 text-neutral-100 border border-neutral-800/60 shadow-inner'
                          : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/40'
                      }`}
                    >
                      <span className="truncate">{f.name}</span>
                      <span className="text-[10px] text-neutral-500 font-bold shrink-0">{f.steps.length} steps</span>
                    </button>
                  ))
                ) : (
                  <div className="text-xs text-neutral-500 py-2">No conversion funnels defined yet.</div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Conversion Funnel Chart */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-neutral-900 bg-neutral-900/20 p-6 min-h-[400px] flex flex-col justify-between">
              {funnelDataLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : funnelData ? (
                <>
                  <div>
                    <h3 className="text-sm font-bold text-neutral-200">{funnelData.name} Conversion</h3>
                    <p className="text-xs text-neutral-400">Step conversion rates for website views in the last 30 days</p>
                  </div>

                  {/* Horizontal Bar Chart */}
                  <div className="h-72 w-full mt-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={funnelData.steps}
                        layout="vertical"
                        margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
                      >
                        <XAxis type="number" domain={[0, 100]} stroke="#404040" fontSize={10} tickLine={false} />
                        <YAxis dataKey="path" type="category" stroke="#404040" fontSize={10} tickLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '12px' }}
                          formatter={(value, name) => {
                            if (name === 'overallConversion') return [`${value}%`, 'Overall Conversion'];
                            if (name === 'count') return [value, 'Views'];
                            return [value, name];
                          }}
                          itemStyle={{ color: '#f5f5f5', fontSize: '12px' }}
                        />
                        <Bar dataKey="overallConversion" fill="hsl(250, 85%, 65%)" radius={[0, 6, 6, 0]} barSize={24}>
                          {funnelData.steps.map((entry: any, index: number) => {
                            // Render gradient scale depending on dropoff
                            const colors = ['#818cf8', '#6366f1', '#4f46e5', '#4338ca', '#312e81'];
                            return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Conversion Step Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                    {funnelData.steps.map((s: any, idx: number) => (
                      <div key={s.path} className="bg-neutral-950 p-4 border border-neutral-900 rounded-xl space-y-2 relative">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Step {s.step}</span>
                          <span className="text-xs font-semibold text-primary">{s.overallConversion}% Conversion</span>
                        </div>
                        <h5 className="text-xs font-bold text-neutral-200 truncate pr-6">{s.path}</h5>
                        <p className="text-xl font-extrabold text-neutral-100">{s.count} <span className="text-[10px] font-medium text-neutral-400">views</span></p>
                        {idx > 0 && (
                          <div className="absolute right-3 bottom-3 flex items-center text-red-400 text-xs font-bold gap-0.5">
                            <span className="text-[9px] font-medium text-neutral-500">Drop-off:</span> {s.dropRate}%
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-neutral-500">
                  <GitMerge className="h-10 w-10 text-neutral-700 mb-3" />
                  <p className="text-xs">Select or create a conversion funnel to display analytics data.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
