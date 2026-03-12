import React, { useState, useEffect, useCallback } from 'react';
import {
  GitBranch, Rocket, CheckCircle, XCircle, AlertTriangle,
  FileCode, SkipForward, RefreshCw, ExternalLink, Info, Clock, X, Globe,
  PlusSquare, Tag, Layout, Plus,
} from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { getAutoDeployMsRemaining, cancelAutoDeploy } from '../../hooks/useSiteContent';
import toast from 'react-hot-toast';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface DeployResult {
  totalRows: number;
  deployedKeys: string[];
  skippedKeys: string[];
  modifiedFiles: string[];
  deletedFromDB: number;
  commitSha: string | null;
  commitUrl: string | null;
  netlifyTriggered: boolean;
  errors: string[];
  message?: string;
}

interface AddEditableResult {
  scannedFiles: number;
  modifiedFiles: string[];
  addedKeys: Array<{ key: string; fallback: string; file: string }>;
  skippedFiles: string[];
  commitSha: string | null;
  commitUrl: string | null;
  errors: string[];
}

type DeployStatus = 'idle' | 'loading' | 'success' | 'error';
type AddStatus    = 'idle' | 'scanning' | 'success' | 'error';

// ─── ROUTES ───────────────────────────────────────────────────────────────────
const ROUTES: Array<{ url: string; label: string; group: string }> = [
  // Sider
  { url: '/',                label: 'Forside',              group: 'Sider' },
  { url: '/products',        label: 'Produkter',            group: 'Sider' },
  { url: '/product/',        label: 'Produkt-detalje',      group: 'Sider' },
  { url: '/portfolio',       label: 'Portfolio',            group: 'Sider' },
  { url: '/search',          label: 'Søg',                  group: 'Sider' },
  { url: '/coverage',        label: 'Dækningsområder',      group: 'Sider' },
  { url: '/simple-request',  label: 'Simpel forespørgsel',  group: 'Sider' },
  { url: '/booking/',        label: 'Booking',              group: 'Sider' },
  { url: '/booking-success', label: 'Booking-bekræftelse',  group: 'Sider' },
  { url: '/payment',         label: 'Betaling',             group: 'Sider' },
  { url: '/donate/',         label: 'Donation',             group: 'Sider' },
  { url: '/ratings',         label: 'Anmeldelser',          group: 'Sider' },
  { url: '/rate-booking/',   label: 'Bedøm booking',        group: 'Sider' },
  { url: '/unsubscribe',     label: 'Afmeld nyhedsbrev',    group: 'Sider' },
  { url: '/file/gofile/',    label: 'Fil-download',         group: 'Sider' },
  // Indhold
  { url: '/terms',           label: 'Vilkår',               group: 'Indhold' },
  { url: '/policies',        label: 'Privatpolitik',        group: 'Indhold' },
  // Konto
  { url: '/auth',            label: 'Login / Opret konto',  group: 'Konto' },
  { url: '/profile',         label: 'Profil',               group: 'Konto' },
  { url: '/buy-credits',     label: 'Køb credits',          group: 'Konto' },
  { url: '/reset-password',  label: 'Nulstil adgangskode',  group: 'Konto' },
  { url: '/update-password', label: 'Opdater adgangskode',  group: 'Konto' },
  { url: '/email-confirmed', label: 'Email bekræftet',      group: 'Konto' },
  // Admin
  { url: '/admin',           label: 'Admin',                group: 'Admin' },
];

function formatMs(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

async function getSupabaseUrl(): Promise<string> {
  return (supabase as any).supabaseUrl as string || import.meta.env.VITE_SUPABASE_URL;
}

// ─── Countdown ────────────────────────────────────────────────────────────────
const AutoDeployCountdown: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
  const [msLeft, setMsLeft] = useState<number | null>(getAutoDeployMsRemaining());
  useEffect(() => {
    const h = (e: Event) => setMsLeft((e as CustomEvent).detail.msRemaining);
    window.addEventListener('autoDeployTimerUpdate', h);
    const t = setInterval(() => setMsLeft(getAutoDeployMsRemaining()), 1000);
    return () => { window.removeEventListener('autoDeployTimerUpdate', h); clearInterval(t); };
  }, []);
  if (msLeft === null) return null;
  return (
    <div className="flex items-center gap-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg px-4 py-3">
      <Clock size={16} className="text-yellow-400 shrink-0 animate-pulse" />
      <div className="flex-1">
        <p className="text-sm text-yellow-300 font-medium">Auto-deploy om <span className="font-mono font-bold">{formatMs(msLeft)}</span></p>
        <p className="text-xs text-yellow-500">Hver indholds-ændring nulstiller timeren</p>
      </div>
      <button onClick={onCancel} className="p-1 rounded hover:bg-yellow-800/50 text-yellow-400 hover:text-yellow-200 transition-colors"><X size={14} /></button>
    </div>
  );
};

// ─── URL Picker Modal ─────────────────────────────────────────────────────────
const UrlPickerModal: React.FC<{
  onClose: () => void;
  onConfirm: (urls: string[]) => void;
}> = ({ onClose, onConfirm }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customInput, setCustomInput] = useState('');
  const [customUrls, setCustomUrls] = useState<string[]>([]);

  const toggle = (url: string) => setSelected(prev => {
    const n = new Set(prev); n.has(url) ? n.delete(url) : n.add(url); return n;
  });
  const selectAll = () => setSelected(new Set([...ROUTES.map(r => r.url), ...customUrls]));
  const clearAll  = () => setSelected(new Set());
  const selectGroup = (g: string) => setSelected(prev => {
    const n = new Set(prev);
    ROUTES.filter(r => r.group === g).forEach(r => n.add(r.url));
    return n;
  });

  const addCustomUrl = () => {
    const raw = customInput.trim();
    if (!raw) return;
    const url = raw.startsWith('/') ? raw : `/${raw}`;
    if (!customUrls.includes(url)) setCustomUrls(prev => [...prev, url]);
    setSelected(prev => new Set([...prev, url]));
    setCustomInput('');
  };

  const removeCustomUrl = (url: string) => {
    setCustomUrls(prev => prev.filter(u => u !== url));
    setSelected(prev => { const n = new Set(prev); n.delete(url); return n; });
  };

  const groups = [...new Set(ROUTES.map(r => r.group))];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      {/* Fixed height using min() so it's tall but never overflows the viewport */}
      <div
        className="bg-neutral-800 border border-neutral-600 rounded-xl w-full max-w-md flex flex-col shadow-2xl"
        style={{ height: 'min(95vh, 740px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-700 shrink-0">
          <div className="flex items-center gap-2">
            <Globe size={20} className="text-primary" />
            <h3 className="text-lg font-bold text-white">Vælg sider at gøre redigerbare</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"><X size={18} /></button>
        </div>

        {/* Info */}
        <div className="mx-5 mt-4 bg-blue-900/20 border border-blue-700/40 rounded-lg px-4 py-3 flex gap-2 shrink-0">
          <Info size={15} className="text-blue-400 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-300">
            For hver URL scannes sidens fil <span className="text-blue-200 font-medium">og alle importerede komponenter</span> rekursivt.
            Hardkodet tekst som <code className="bg-neutral-800 px-1 rounded">&lt;h2&gt;Min Tekst&lt;/h2&gt;</code> erstattes med{' '}
            <code className="bg-neutral-800 px-1 rounded">&lt;EditableContent … /&gt;</code>.
            NavBar og Footer inkluderes altid automatisk.
          </p>
        </div>

        {/* Quick select */}
        <div className="px-5 pt-3 flex flex-wrap gap-2 shrink-0">
          <button onClick={selectAll}  className="text-xs px-2 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors">Vælg alle</button>
          <button onClick={clearAll}   className="text-xs px-2 py-1 rounded bg-neutral-700 text-neutral-300 hover:bg-neutral-600 transition-colors">Fravælg alle</button>
          {groups.map(g => (
            <button key={g} onClick={() => selectGroup(g)} className="text-xs px-2 py-1 rounded bg-neutral-700 text-neutral-300 hover:bg-neutral-600 transition-colors">
              + {g}
            </button>
          ))}
          <span className="ml-auto text-xs text-neutral-400 self-center">{selected.size} valgt</span>
        </div>

        {/* Route list — flex-1 + min-h-0 is the key: forces overflow to activate */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4 min-h-0">
          {groups.map(group => (
            <div key={group}>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">{group}</p>
              <div className="space-y-1">
                {ROUTES.filter(r => r.group === group).map(route => (
                  <label key={route.url} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-700/60 cursor-pointer group border border-transparent hover:border-neutral-600 transition-all">
                    <input
                      type="checkbox"
                      checked={selected.has(route.url)}
                      onChange={() => toggle(route.url)}
                      className="rounded accent-primary shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium group-hover:text-primary transition-colors">{route.label}</p>
                      <p className="text-xs font-mono text-neutral-500">{route.url}</p>
                    </div>
                    <Layout size={13} className="text-neutral-600 group-hover:text-neutral-400 shrink-0" />
                  </label>
                ))}
              </div>
            </div>
          ))}

          {/* Custom URLs */}
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Brugerdefineret URL</p>
            {customUrls.map(url => (
              <label key={url} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-700/60 cursor-pointer group border border-transparent hover:border-neutral-600 transition-all mb-1">
                <input
                  type="checkbox"
                  checked={selected.has(url)}
                  onChange={() => toggle(url)}
                  className="rounded accent-primary shrink-0"
                />
                <p className="flex-1 text-xs font-mono text-neutral-300">{url}</p>
                <button
                  onClick={e => { e.preventDefault(); removeCustomUrl(url); }}
                  className="p-1 rounded hover:bg-red-900/40 text-neutral-600 hover:text-red-400 transition-colors shrink-0"
                >
                  <X size={12} />
                </button>
              </label>
            ))}
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomUrl(); } }}
                placeholder="/min-side eller /produkt/123"
                className="flex-1 text-xs font-mono bg-neutral-900 border border-neutral-600 rounded-lg px-3 py-2.5 text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-primary/60 transition-colors"
              />
              <button
                onClick={addCustomUrl}
                disabled={!customInput.trim()}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0
                  ${!customInput.trim() ? 'bg-neutral-700 text-neutral-500 cursor-not-allowed' : 'bg-primary/20 hover:bg-primary/30 text-primary'}`}
              >
                <Plus size={13} /> Tilføj
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-neutral-700 flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-medium transition-colors">Annuller</button>
          <button
            disabled={selected.size === 0}
            onClick={() => onConfirm([...selected])}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2
              ${selected.size === 0 ? 'bg-neutral-600 text-neutral-500 cursor-not-allowed' : 'bg-primary hover:bg-primary/90 text-white'}`}
          >
            <PlusSquare size={15} />
            Scan {selected.size} side{selected.size !== 1 ? 'r' : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Add Result Panel ─────────────────────────────────────────────────────────
const AddResultPanel: React.FC<{ result: AddEditableResult }> = ({ result }) => {
  const [open, setOpen] = useState<Record<string, boolean>>({ keys: true });
  const toggle = (k: string) => setOpen(p => ({ ...p, [k]: !p[k] }));
  const hasErr = result.errors.length > 0;
  return (
    <div className="border border-neutral-600 rounded-xl overflow-hidden">
      <div className={`px-5 py-4 flex items-center gap-3 border-b ${hasErr && !result.addedKeys.length ? 'bg-red-900/30 border-red-700/40' : 'bg-green-900/20 border-green-700/30'}`}>
        {hasErr && !result.addedKeys.length ? <XCircle size={20} className="text-red-400" /> : <CheckCircle size={20} className="text-green-400" />}
        <div className="flex-1">
          <p className="font-semibold text-white">
            {result.addedKeys.length > 0
              ? `${result.addedKeys.length} tekst-node${result.addedKeys.length !== 1 ? 'r' : ''} gjort redigerbar${result.addedKeys.length !== 1 ? 'e' : ''} i ${result.modifiedFiles.length} fil${result.modifiedFiles.length !== 1 ? 'er' : ''}`
              : 'Ingen hardkodet tekst fundet — alt er allerede redigerbart'}
          </p>
          {result.commitSha && (
            <a href={result.commitUrl ?? '#'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline mt-0.5">
              <ExternalLink size={11} /> Commit: {result.commitSha.slice(0, 7)}
            </a>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 p-5">
        <div className="bg-neutral-800 rounded-lg p-3 text-center">
          <Globe size={15} className="text-neutral-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-neutral-300">{result.scannedFiles}</p>
          <p className="text-xs text-neutral-500">Filer scannet</p>
        </div>
        <div className="bg-neutral-800 rounded-lg p-3 text-center">
          <FileCode size={15} className="text-blue-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-blue-400">{result.modifiedFiles.length}</p>
          <p className="text-xs text-neutral-500">Filer ændret</p>
        </div>
        <div className="bg-neutral-800 rounded-lg p-3 text-center">
          <Tag size={15} className="text-green-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-green-400">{result.addedKeys.length}</p>
          <p className="text-xs text-neutral-500">Nøgler tilføjet</p>
        </div>
      </div>
      <div className="px-5 pb-5 space-y-3">
        {result.addedKeys.length > 0 && (
          <Collapsible title={`Tilføjede nøgler (${result.addedKeys.length})`} color="green" open={!!open['keys']} onToggle={() => toggle('keys')}>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {result.addedKeys.map(({ key, fallback }) => (
                <div key={key} className="flex items-start gap-2 text-xs py-0.5">
                  <span className="font-mono text-green-300 shrink-0">{key}</span>
                  <span className="text-neutral-600">→</span>
                  <span className="text-neutral-400 italic truncate">"{fallback.slice(0, 70)}{fallback.length > 70 ? '…' : ''}"</span>
                </div>
              ))}
            </div>
          </Collapsible>
        )}
        {result.modifiedFiles.length > 0 && (
          <Collapsible title={`Ændrede filer (${result.modifiedFiles.length})`} color="blue" open={!!open['files']} onToggle={() => toggle('files')}>
            <TagList items={result.modifiedFiles} color="blue" mono />
          </Collapsible>
        )}
        {result.errors.length > 0 && (
          <Collapsible title={`Fejl (${result.errors.length})`} color="red" open onToggle={() => toggle('errors')}>
            <ul className="space-y-1">{result.errors.map((e, i) => (
              <li key={i} className="flex gap-2 text-xs text-red-300"><AlertTriangle size={13} className="shrink-0 mt-0.5" /><span className="font-mono break-all">{e}</span></li>
            ))}</ul>
          </Collapsible>
        )}
      </div>
    </div>
  );
};

// ─── Shared sub-components ────────────────────────────────────────────────────
const colorMap = {
  green:  { bg: 'bg-green-900/20',  border: 'border-green-700/40',  text: 'text-green-400',  badge: 'bg-green-900/40 text-green-300'  },
  blue:   { bg: 'bg-blue-900/20',   border: 'border-blue-700/40',   text: 'text-blue-400',   badge: 'bg-blue-900/40 text-blue-300'    },
  yellow: { bg: 'bg-yellow-900/20', border: 'border-yellow-700/40', text: 'text-yellow-400', badge: 'bg-yellow-900/40 text-yellow-300' },
  red:    { bg: 'bg-red-900/20',    border: 'border-red-700/40',    text: 'text-red-400',    badge: 'bg-red-900/40 text-red-300'      },
};

const Collapsible: React.FC<{ title: string; color: keyof typeof colorMap; open: boolean; onToggle: () => void; children: React.ReactNode }> = ({ title, color, open, onToggle, children }) => {
  const c = colorMap[color];
  return (
    <div className={`rounded-lg border ${c.border} overflow-hidden`}>
      <button onClick={onToggle} className={`w-full flex items-center justify-between px-4 py-2.5 ${c.bg} text-sm font-medium ${c.text} hover:brightness-110 transition-all`}>
        <span>{title}</span><span className="text-xs opacity-60">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-4 py-3 bg-neutral-800/50">{children}</div>}
    </div>
  );
};

const TagList: React.FC<{ items: string[]; color: keyof typeof colorMap; mono?: boolean }> = ({ items, color, mono }) => {
  const c = colorMap[color];
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(item => <span key={item} className={`text-xs px-2 py-0.5 rounded ${c.badge} ${mono ? 'font-mono' : ''}`}>{item}</span>)}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const DeployContentManager: React.FC = () => {
  const [contentCount, setContentCount] = useState<number | null>(null);
  const [deployStatus, setDeployStatus] = useState<DeployStatus>('idle');
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);
  const [expanded, setExpanded]         = useState<Record<string, boolean>>({});
  const [hasTimer, setHasTimer]         = useState(false);
  const [showUrlPicker, setShowUrlPicker]   = useState(false);
  const [addStatus, setAddStatus]           = useState<AddStatus>('idle');
  const [addResult, setAddResult]           = useState<AddEditableResult | null>(null);
  const [scanningUrls, setScanningUrls]     = useState<string[]>([]);

  useEffect(() => {
    const h = (e: Event) => setHasTimer((e as CustomEvent).detail.msRemaining !== null);
    window.addEventListener('autoDeployTimerUpdate', h);
    setHasTimer(getAutoDeployMsRemaining() !== null);
    return () => window.removeEventListener('autoDeployTimerUpdate', h);
  }, []);

  const loadCount = useCallback(async () => {
    const { count } = await supabase.from('site_content').select('*', { count: 'exact', head: true });
    setContentCount(count ?? 0);
  }, []);
  useEffect(() => { loadCount(); }, [loadCount]);

  const handleDeploy = async () => {
    if (deployStatus === 'loading') return;
    if (!window.confirm(
      `Deploy ${contentCount ?? 'all'} editable content row(s) til GitHub?\n\n` +
      `Dette vil:\n  • Opdatere fallback-værdier i kildefiler\n  • Committe til dit repository\n  • Slette de deployede rækker fra databasen`
    )) return;

    cancelAutoDeploy(); setHasTimer(false);
    setDeployStatus('loading'); setDeployResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const base = await getSupabaseUrl();
      const res = await fetch(`${base}/functions/v1/deploy-content-to-github`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      });
      const data: DeployResult = await res.json();
      setDeployResult(data);
      if (data.errors.length > 0 && data.deployedKeys.length === 0) {
        setDeployStatus('error'); toast.error('Deploy fejlede');
      } else {
        setDeployStatus('success');
        toast.success(data.deployedKeys.length > 0
          ? `Deployed ${data.deployedKeys.length} nøgle(r)${data.netlifyTriggered ? ' · Netlify triggered ✓' : ''}`
          : (data.message ?? 'Intet at deploye'));
        await loadCount();
      }
    } catch (err: any) {
      setDeployStatus('error');
      setDeployResult({ totalRows: 0, deployedKeys: [], skippedKeys: [], modifiedFiles: [], deletedFromDB: 0, commitSha: null, commitUrl: null, netlifyTriggered: false, errors: [err.message] });
      toast.error('Deploy fejlede');
    }
  };

  const handleAddEditable = async (urls: string[]) => {
    setShowUrlPicker(false);
    setScanningUrls(urls);
    setAddStatus('scanning'); setAddResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const base = await getSupabaseUrl();
      const res = await fetch(`${base}/functions/v1/add-editable-content-to-github`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ urls }),
      });
      const data: AddEditableResult = await res.json();
      setAddResult(data);
      if (data.errors.length > 0 && data.addedKeys.length === 0) {
        setAddStatus('error'); toast.error('Tilføjelse fejlede');
      } else {
        setAddStatus('success');
        toast.success(data.addedKeys.length > 0
          ? `${data.addedKeys.length} tekst-node(r) gjort redigerbare, committed til GitHub`
          : 'Ingen hardkodet tekst fundet');
      }
    } catch (err: any) {
      setAddStatus('error');
      setAddResult({ scannedFiles: 0, modifiedFiles: [], addedKeys: [], skippedFiles: [], commitSha: null, commitUrl: null, errors: [err.message] });
      toast.error('Tilføjelse fejlede');
    }
  };

  const handleCancelTimer = () => { cancelAutoDeploy(); setHasTimer(false); toast('Auto-deploy annulleret', { icon: '⏹' }); };
  const toggle = (s: string) => setExpanded(p => ({ ...p, [s]: !p[s] }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GitBranch size={24} className="text-primary" />
        <div>
          <h2 className="text-xl font-bold text-white">Deploy til GitHub</h2>
          <p className="text-sm text-neutral-400">Bager redigerbart indhold ind i kildekoden som hardcoded værdier</p>
        </div>
      </div>

      <div className="bg-neutral-700/40 border border-neutral-600 rounded-lg p-4 flex gap-3">
        <Info size={18} className="text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-neutral-300 space-y-1">
          <p>Deploy-funktionen synkroniser ændret indhold fra databasen tilbage til kildekoden:</p>
          <ol className="list-decimal list-inside space-y-0.5 text-neutral-400">
            <li>Henter alle rækker fra <code className="text-xs bg-neutral-800 px-1 rounded">site_content</code></li>
            <li>Opdaterer <code className="text-xs bg-neutral-800 px-1 rounded">fallback</code>-værdier i kildefilerne</li>
            <li>Committer til GitHub + trigger Netlify rebuild</li>
          </ol>
          <p className="text-neutral-500 text-xs mt-1">Auto-deploy sker 8 minutter efter den seneste ændring.</p>
        </div>
      </div>

      {hasTimer && <AutoDeployCountdown onCancel={handleCancelTimer} />}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-neutral-700/50 rounded-lg p-4 border border-neutral-600">
          <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">Klar til deploy</p>
          <p className="text-3xl font-bold text-white">{contentCount === null ? '…' : contentCount}</p>
          <p className="text-xs text-neutral-500 mt-1">rækker i site_content</p>
        </div>
        <div className="bg-neutral-700/50 rounded-lg p-4 border border-neutral-600 flex flex-col justify-between">
          <p className="text-xs text-neutral-400 uppercase tracking-wider mb-2">Status</p>
          {deployStatus === 'idle'    && <span className="text-sm text-neutral-400">Klar</span>}
          {deployStatus === 'loading' && <span className="flex items-center gap-2 text-sm text-yellow-400"><RefreshCw size={14} className="animate-spin" /> Deployer…</span>}
          {deployStatus === 'success' && <span className="flex items-center gap-2 text-sm text-green-400"><CheckCircle size={14} /> Gennemført</span>}
          {deployStatus === 'error'   && <span className="flex items-center gap-2 text-sm text-red-400"><XCircle size={14} /> Fejl</span>}
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={handleDeploy}
          disabled={deployStatus === 'loading' || contentCount === 0}
          className={`flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-semibold transition-all text-white
            ${deployStatus === 'loading' ? 'bg-neutral-600 cursor-not-allowed'
              : contentCount === 0 ? 'bg-neutral-700 cursor-not-allowed text-neutral-500'
              : 'bg-primary hover:bg-primary/90 active:scale-[0.98]'}`}
        >
          {deployStatus === 'loading' ? <><RefreshCw size={17} className="animate-spin" /> Deployer…</> : <><Rocket size={17} /> Deploy til GitHub</>}
        </button>

        <button
          onClick={() => setShowUrlPicker(true)}
          disabled={addStatus === 'scanning'}
          className={`flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-semibold transition-all border
            ${addStatus === 'scanning'
              ? 'bg-neutral-700 border-neutral-600 text-neutral-400 cursor-not-allowed'
              : 'bg-neutral-700/60 border-neutral-500 hover:bg-neutral-600 hover:border-primary/60 text-white active:scale-[0.98]'}`}
        >
          {addStatus === 'scanning'
            ? <><RefreshCw size={17} className="animate-spin" /> Scanner {scanningUrls.length} side{scanningUrls.length !== 1 ? 'r' : ''}…</>
            : <><PlusSquare size={17} className="text-primary" /> Gør tekst redigerbar</>}
        </button>
      </div>

      {contentCount === 0 && deployStatus !== 'loading' && (
        <p className="text-center text-sm text-neutral-500">Ingen redigerbart indhold at deploye – databasen er ren.</p>
      )}

      {/* Hint */}
      <div className="bg-neutral-800/50 border border-neutral-700 rounded-lg px-4 py-3 flex gap-2">
        <Globe size={14} className="text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-neutral-400">
          <span className="text-neutral-200 font-medium">Gør tekst redigerbar</span> — Vælg sider via URL, og backend'en scanner siden og alle importerede komponenter rekursivt.
          Hardkodet tekst erstattes med <code className="bg-neutral-900 px-1 rounded text-neutral-300">&lt;EditableContent /&gt;</code>.
          NavBar og Footer er altid inkluderet. Dynamiske udtryk og eksisterende EditableContent berøres ikke.
        </p>
      </div>

      {addResult && <AddResultPanel result={addResult} />}

      {/* Deploy result */}
      {deployResult && (
        <div className="space-y-4 border border-neutral-600 rounded-xl overflow-hidden">
          <div className={`px-5 py-4 flex items-center gap-3 ${deployResult.errors.length > 0 && !deployResult.deployedKeys.length ? 'bg-red-900/30 border-b border-red-700/40' : 'bg-green-900/20 border-b border-green-700/30'}`}>
            {deployResult.errors.length > 0 && !deployResult.deployedKeys.length ? <XCircle size={20} className="text-red-400" /> : <CheckCircle size={20} className="text-green-400" />}
            <div className="flex-1">
              <p className="font-semibold text-white">
                {deployResult.message ?? (deployResult.deployedKeys.length > 0 ? `${deployResult.deployedKeys.length} nøgle(r) deployed og committed til GitHub` : 'Ingen ændringer foretaget')}
              </p>
              {deployResult.commitSha && (
                <a href={deployResult.commitUrl ?? '#'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline mt-0.5">
                  <ExternalLink size={11} /> Commit: {deployResult.commitSha.slice(0, 7)}
                </a>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5">
            {[
              { label: 'Deployed',      value: deployResult.deployedKeys.length,  color: 'text-green-400',  icon: CheckCircle },
              { label: 'Sprunget over', value: deployResult.skippedKeys.length,   color: 'text-yellow-400', icon: SkipForward  },
              { label: 'Filer ændret',  value: deployResult.modifiedFiles.length, color: 'text-blue-400',   icon: FileCode     },
              { label: 'Netlify', value: deployResult.netlifyTriggered ? '✓' : '–', color: deployResult.netlifyTriggered ? 'text-green-400' : 'text-neutral-500', icon: Globe },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="bg-neutral-800 rounded-lg p-3 text-center">
                <Icon size={16} className={`${color} mx-auto mb-1`} />
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-neutral-500">{label}</p>
              </div>
            ))}
          </div>
          <div className="px-5 pb-5 space-y-3">
            {deployResult.deployedKeys.length > 0 && (
              <Collapsible title={`Deployed nøgler (${deployResult.deployedKeys.length})`} color="green" open={!!expanded['deployed']} onToggle={() => toggle('deployed')}>
                <TagList items={deployResult.deployedKeys} color="green" />
              </Collapsible>
            )}
            {deployResult.modifiedFiles.length > 0 && (
              <Collapsible title={`Ændrede filer (${deployResult.modifiedFiles.length})`} color="blue" open={!!expanded['files']} onToggle={() => toggle('files')}>
                <TagList items={deployResult.modifiedFiles} color="blue" mono />
              </Collapsible>
            )}
            {deployResult.skippedKeys.length > 0 && (
              <Collapsible title={`Sprunget over (${deployResult.skippedKeys.length})`} color="yellow" open={!!expanded['skipped']} onToggle={() => toggle('skipped')}>
                <p className="text-xs text-neutral-400 mb-2">Disse nøgler er i databasen men mangler i kildekoden som <code className="bg-neutral-800 px-1 rounded">fallback</code>.</p>
                <TagList items={deployResult.skippedKeys} color="yellow" />
              </Collapsible>
            )}
            {deployResult.errors.length > 0 && (
              <Collapsible title={`Fejl (${deployResult.errors.length})`} color="red" open={!!expanded['errors'] ?? true} onToggle={() => toggle('errors')}>
                <ul className="space-y-1">{deployResult.errors.map((e, i) => (
                  <li key={i} className="flex gap-2 text-xs text-red-300"><AlertTriangle size={13} className="shrink-0 mt-0.5" /><span className="font-mono break-all">{e}</span></li>
                ))}</ul>
              </Collapsible>
            )}
          </div>
        </div>
      )}

      {showUrlPicker && <UrlPickerModal onClose={() => setShowUrlPicker(false)} onConfirm={handleAddEditable} />}
    </div>
  );
};

export default DeployContentManager;