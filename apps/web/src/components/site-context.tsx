'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import useSWR from 'swr';

export interface Site {
  id: string;
  domain: string;
  api_key: string;
}

interface SiteContextType {
  sites: Site[];
  activeSite: Site | null;
  setActiveSiteId: (id: string) => void;
  mutateSites: () => void;
  loading: boolean;
}

const SiteContext = createContext<SiteContextType | undefined>(undefined);

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const { data: sites, mutate, isLoading } = useSWR<Site[]>('/api/sites', fetcher);
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);

  useEffect(() => {
    if (sites && sites.length > 0) {
      // If we don't have an active site, or the current one is no longer in the list, set it to the first site
      const exists = sites.some(s => s.id === activeSiteId);
      if (!activeSiteId || !exists) {
        setActiveSiteId(sites[0].id);
      }
    }
  }, [sites, activeSiteId]);

  const activeSite = sites?.find((s) => s.id === activeSiteId) || null;

  return (
    <SiteContext.Provider
      value={{
        sites: sites || [],
        activeSite,
        setActiveSiteId,
        mutateSites: mutate,
        loading: isLoading,
      }}
    >
      {children}
    </SiteContext.Provider>
  );
}

export function useSite() {
  const context = useContext(SiteContext);
  if (!context) {
    throw new Error('useSite must be used within a SiteProvider');
  }
  return context;
}
