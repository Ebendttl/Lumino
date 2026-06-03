'use client';

import React, { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { useSite } from '@/components/site-context';
import DashboardHeader from '@/components/dashboard-header';
import { Activity, Laptop, Smartphone, Tablet, Bot, Globe, Loader2, ArrowRight } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface LiveEvent {
  page: string;
  device: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';
  country: string | null;
  city: string | null;
  ts: number;
  id: string; // generated locally for list keys
}

/**
 * Converts a 2-letter country code into a native flag emoji.
 */
function getFlagEmoji(countryCode: string | null): string {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export default function RealtimePage() {
  const { activeSite } = useSite();
  const [mounted, setMounted] = useState(false);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch initial active visitor count (events in the last 5 minutes)
  const { data, mutate: mutateActive } = useSWR(
    mounted && activeSite ? `/api/realtime/active?siteId=${activeSite.id}` : null,
    fetcher,
    { refreshInterval: 10000 } // Refetch every 10s to keep in sync
  );

  // Set up WebSocket connection for live event streaming
  useEffect(() => {
    if (!mounted || !activeSite) return;

    setWsStatus('connecting');
    setLiveEvents([]); // Clear list on site switch

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host.replace(':3000', ':3001');
    const wsUrl = `${protocol}//${wsHost}`;

    console.log(`[Realtime] Connecting to WebSocket: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[Realtime] WebSocket connected.');
      setWsStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Add local unique ID and push to state
        const newEvent: LiveEvent = {
          ...data,
          id: Math.random().toString(36).substring(2, 9),
        };

        setLiveEvents((prev) => {
          const updated = [newEvent, ...prev];
          // Limit to 20 items to prevent rendering performance degrade
          return updated.slice(0, 20);
        });

        // Trigger active count refresh
        mutateActive();
      } catch (err) {
        console.error('[Realtime] Error parsing ws event:', err);
      }
    };

    ws.onclose = () => {
      console.log('[Realtime] WebSocket disconnected.');
      setWsStatus('disconnected');
    };

    ws.onerror = (err) => {
      console.error('[Realtime] WebSocket error:', err);
      setWsStatus('disconnected');
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [mounted, activeSite, mutateActive]);

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
        <DashboardHeader title="Live Traffic" />
        <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] text-center px-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-900 border border-neutral-850 text-neutral-400 mb-6">
            <Activity className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-neutral-200">No Websites Registered</h2>
          <p className="text-neutral-400 text-sm max-w-sm mt-2 mb-6">
            Register your domain first to start monitoring live web traffic.
          </p>
        </div>
      </>
    );
  }

  const activeVisitors = data?.activeVisitors ?? 0;

  const renderDeviceIcon = (device: LiveEvent['device']) => {
    switch (device) {
      case 'mobile':
        return <Smartphone className="h-4 w-4 text-neutral-400" />;
      case 'tablet':
        return <Tablet className="h-4 w-4 text-neutral-400" />;
      case 'bot':
        return <Bot className="h-4 w-4 text-rose-500" />;
      default:
        return <Laptop className="h-4 w-4 text-neutral-400" />;
    }
  };

  return (
    <>
      <DashboardHeader title="Live Traffic Feed" />

      <div className="p-6 md:p-8 lg:p-10 space-y-8 max-w-5xl mx-auto">
        {/* Visitors Online Counter */}
        <div className="rounded-2xl border border-neutral-900 bg-neutral-900/20 p-8 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-2xl">
          {/* Glowing pulse ring */}
          <div className="absolute inset-0 bg-primary/5 blur-xl pointer-events-none" />
          
          <div className="flex items-center gap-2 mb-4 bg-primary/10 border border-primary/20 px-3.5 py-1.5 rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-bold tracking-wider uppercase text-neutral-300">
              {wsStatus === 'connected' ? 'Live Connection Active' : wsStatus === 'connecting' ? 'Establishing stream...' : 'Reconnecting...'}
            </span>
          </div>

          <h3 className="text-6xl font-extrabold text-neutral-100 tracking-tight glow-text select-none">
            {activeVisitors}
          </h3>
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mt-4">
            Visitors Online Now
          </p>
          <p className="text-[10px] text-neutral-500 mt-1 max-w-xs">
            Calculated as the number of events captured from <code>{activeSite.domain}</code> in the last 5 minutes.
          </p>
        </div>

        {/* Real-time Event Feed Stream */}
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-neutral-200">Activity Stream</h4>
          <div className="rounded-2xl border border-neutral-900 bg-neutral-900/10 divide-y divide-neutral-900 overflow-hidden">
            {liveEvents.length > 0 ? (
              <div className="divide-y divide-neutral-900 max-h-[500px] overflow-y-auto">
                {liveEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-4 hover:bg-neutral-900/30 transition duration-150 animate-slide-down"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-neutral-900 border border-neutral-850 flex items-center justify-center shrink-0">
                        {renderDeviceIcon(event.device)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-neutral-200 truncate max-w-[200px] sm:max-w-md">
                            {event.page}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 font-semibold mt-0.5">
                          <span>{getFlagEmoji(event.country)}</span>
                          <span>{event.city || 'Unknown Location'}</span>
                          {event.country && <span className="uppercase">{event.country}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] font-bold text-neutral-500 whitespace-nowrap bg-neutral-900/80 px-2.5 py-1 rounded-md border border-neutral-850">
                      {new Date(event.ts).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center text-neutral-500">
                <Loader2 className="h-6 w-6 animate-spin text-neutral-700 mb-3" />
                <p className="text-xs">Waiting for incoming traffic on <code>{activeSite.domain}</code>...</p>
                <p className="text-[10px] text-neutral-600 mt-1 max-w-xs px-4">
                  Trigger page loads on your site with the tracking code installed to see them stream here instantly.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
