'use client';

import React, { useState } from 'react';
import { useSite } from './site-context';
import { ChevronDown, Copy, Globe, Loader2, Plus, X } from 'lucide-react';

interface HeaderProps {
  title: string;
}

export default function DashboardHeader({ title }: HeaderProps) {
  const { sites, activeSite, setActiveSiteId, mutateSites } = useSite();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [domain, setDomain] = useState('');
  const [newSiteApiKey, setNewSiteApiKey] = useState<string | null>(null);
  const [newSiteId, setNewSiteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain) return;
    setLoading(true);

    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });

      if (res.ok) {
        const data = await res.json();
        setNewSiteApiKey(data.api_key);
        setNewSiteId(data.id);
        mutateSites();
        setDomain('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    const origin = window.location.origin;
    // The ingestion gateway runs on port 3001 (or local host gateway)
    const scriptUrl = `${origin.replace(':3000', ':3001')}/analytics.js`;
    const code = `<script src="${scriptUrl}" data-site-id="${newSiteApiKey || activeSite?.api_key}"></script>`;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="h-16 border-b border-neutral-900 px-6 flex items-center justify-between bg-neutral-950/80 backdrop-blur-md sticky top-0 z-30">
      <h1 className="text-xl font-bold text-neutral-100">{title}</h1>

      <div className="flex items-center gap-4">
        {/* Site Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border border-neutral-850 rounded-xl text-xs font-semibold text-neutral-300 hover:text-neutral-100 hover:bg-neutral-850 transition duration-150"
          >
            <Globe className="h-3.5 w-3.5 text-primary" />
            <span>{activeSite ? activeSite.domain : 'Select Site'}</span>
            <ChevronDown className="h-3.5 w-3.5 text-neutral-500" />
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-neutral-850 bg-neutral-900 shadow-2xl p-1.5 z-20 space-y-1">
                {sites.map((site) => (
                  <button
                    key={site.id}
                    onClick={() => {
                      setActiveSiteId(site.id);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition duration-150 ${
                      activeSite?.id === site.id
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850'
                    }`}
                  >
                    {site.domain}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Add Site Button */}
        <button
          onClick={() => {
            setNewSiteApiKey(null);
            setNewSiteId(null);
            setModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 transition duration-150"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Site</span>
        </button>

        {activeSite && !modalOpen && (
          <button
            onClick={() => {
              setNewSiteApiKey(activeSite.api_key);
              setNewSiteId(activeSite.id);
              setModalOpen(true);
            }}
            className="px-3 py-1.5 border border-neutral-800 hover:border-neutral-700 bg-neutral-900/40 rounded-xl text-xs font-medium text-neutral-400 hover:text-neutral-200 transition duration-150"
          >
            Tracking Code
          </button>
        )}
      </div>

      {/* Modal Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="bg-neutral-900 border border-neutral-850 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative z-10 space-y-6">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-neutral-500 hover:text-neutral-300"
            >
              <X className="h-5 w-5" />
            </button>

            {newSiteApiKey ? (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
                  <span className="text-emerald-500">✔</span> Website Configured
                </h3>
                <p className="text-xs text-neutral-400">
                  Copy and paste the tracking snippet into the <code>&lt;head&gt;</code> of your website:
                </p>
                <div className="relative bg-neutral-950 p-4 rounded-xl border border-neutral-850 font-mono text-[10px] text-primary break-all pr-12 select-all">
                  {`<script src="${window.location.origin.replace(':3000', ':3001')}/analytics.js" data-site-id="${newSiteApiKey}"></script>`}
                  <button
                    onClick={handleCopyCode}
                    className="absolute top-3 right-3 p-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-400 hover:text-neutral-200"
                  >
                    {copied ? <span className="text-xs text-emerald-500 font-sans">Copied</span> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 bg-neutral-850 hover:bg-neutral-800 rounded-xl text-xs font-semibold"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddSite} className="space-y-4">
                <h3 className="text-lg font-bold text-neutral-100">Add New Domain</h3>
                <div className="space-y-2">
                  <label htmlFor="modal-domain" className="block text-xs font-medium text-neutral-400">
                    Domain name (no http/https protocols)
                  </label>
                  <input
                    id="modal-domain"
                    type="text"
                    required
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="my-cool-blog.com"
                    className="block w-full px-3 py-2 bg-neutral-950 border border-neutral-850 rounded-xl text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-xs"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 border border-neutral-850 bg-neutral-900 hover:bg-neutral-850 rounded-xl text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/95 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Register'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
