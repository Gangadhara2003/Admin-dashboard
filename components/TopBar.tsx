'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../contexts/UserContext';

const ADMIN_PAGES = [
  { label: 'Dashboard', href: '/admin', keywords: ['home', 'overview'] },
  { label: 'Users', href: '/admin/users', keywords: ['customers', 'firebase'] },
  { label: 'Suppliers', href: '/admin/suppliers', keywords: ['vendor', 'partner'] },
  { label: 'Catalog Upload', href: '/admin/catalog-upload', keywords: ['bulk', 'import', 'csv'] },
  { label: 'Products', href: '/admin/products', keywords: ['inventory', 'stock', 'shopify'] },
  { label: 'Product Submissions', href: '/admin/submissions', keywords: ['requests', 'new product'] },
  { label: 'Product Updates', href: '/admin/product-updates', keywords: ['price', 'quantity', 'changes'] },
  { label: 'Orders', href: '/admin/orders', keywords: ['shopify', 'purchase'] },
  { label: 'Order Acceptance', href: '/admin/order-acceptance', keywords: ['supplier response', 'accepted', 'rejected'] },
  { label: 'Order History', href: '/admin/order-history', keywords: ['past', 'completed', 'cancelled'] },
  { label: 'Feedback', href: '/admin/feedback', keywords: ['review', 'rating'] },
  { label: 'Deliveries', href: '/admin/deliveries', keywords: ['dispatch', 'transit', 'delivery boy'] },
  { label: 'Payments', href: '/admin/payments', keywords: ['payout', 'paid', 'billing'] },
  { label: 'GST Requests', href: '/admin/gst-requests', keywords: ['invoice', 'tax'] },
  { label: 'Returns', href: '/admin/returns', keywords: ['refund', 'return'] },
  { label: 'Interventions', href: '/admin/interventions', keywords: ['escalation', 'issue'] },
  { label: 'SLA Alerts', href: '/admin/sla-alerts', keywords: ['breach', 'warning', 'deadline'] },
  { label: 'Shift Reports', href: '/admin/shift-reports', keywords: ['daily', 'summary'] },
  { label: 'Finance', href: '/admin/finance', keywords: ['revenue', 'gmv', 'money'] },
  { label: 'Support', href: '/admin/support', keywords: ['chat', 'help', 'message'] },
  { label: 'Reports', href: '/admin/reports', keywords: ['analytics', 'data'] },
  { label: 'Settings', href: '/admin/settings', keywords: ['config', 'password', 'profile'] },
];

interface SearchResult {
  type: 'page' | 'order' | 'product' | 'supplier';
  label: string;
  sublabel?: string;
  href: string;
}

interface TopBarProps {
  onSearch?: (query: string) => void;
}

export default function TopBar({ onSearch }: TopBarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifTab, setNotifTab] = useState<'notifications' | 'history'>('notifications');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevUnreadRef = useRef<number | null>(null);
  const router = useRouter();

  // About NEXUS modal
  const [showAbout, setShowAbout] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [aboutLoading, setAboutLoading] = useState(false);
  const [aboutEditing, setAboutEditing] = useState(false);
  const [aboutForm, setAboutForm] = useState<any>({});
  const [aboutSaving, setAboutSaving] = useState(false);

  const { user } = useUser();

  // Search logic
  const searchPages = (q: string): SearchResult[] => {
    const lower = q.toLowerCase();
    return ADMIN_PAGES.filter(p =>
      p.label.toLowerCase().includes(lower) ||
      p.keywords.some(k => k.includes(lower))
    ).slice(0, 5).map(p => ({ type: 'page', label: p.label, sublabel: p.href, href: p.href }));
  };

  const searchData = async (q: string) => {
    if (q.length < 2) { setSearchLoading(false); return; }
    setSearchLoading(true);
    try {
      const [ordersRes, productsRes, suppliersRes] = await Promise.all([
        fetch(`/api/supplier-orders?search=${encodeURIComponent(q)}&limit=5`).then(r => r.json()).catch(() => ({ orders: [] })),
        fetch('/api/supplier-products').then(r => r.json()).catch(() => ({ products: [] })),
        fetch('/api/admin/suppliers').then(r => r.json()).catch(() => ({ suppliers: [] })),
      ]);

      const lower = q.toLowerCase();
      const orderResults: SearchResult[] = (ordersRes.orders || []).slice(0, 5).map((o: any) => ({
        type: 'order' as const,
        label: `Order ${o.shopifyOrderRef || o._id?.slice(-6)}`,
        sublabel: `${o.supplierName || 'Unknown'} · ${o.status}`,
        href: '/admin/order-acceptance',
      }));

      const productResults: SearchResult[] = (productsRes.products || [])
        .filter((p: any) => (p.shopifyTitle || '').toLowerCase().includes(lower) || (p.supplierName || '').toLowerCase().includes(lower))
        .slice(0, 5).map((p: any) => ({
          type: 'product' as const,
          label: p.shopifyTitle || 'Untitled Product',
          sublabel: `${p.supplierName || 'Unknown'} · ${p.status}`,
          href: '/admin/submissions',
        }));

      const supplierResults: SearchResult[] = (suppliersRes.suppliers || [])
        .filter((s: any) => (s.name || '').toLowerCase().includes(lower) || (s.businessName || '').toLowerCase().includes(lower) || (s.phone || '').includes(q))
        .slice(0, 5).map((s: any) => ({
          type: 'supplier' as const,
          label: s.businessName || s.name,
          sublabel: s.phone,
          href: '/admin/suppliers',
        }));

      setSearchResults(prev => {
        const pages = prev.filter(r => r.type === 'page');
        return [...pages, ...orderResults, ...productResults, ...supplierResults];
      });
    } catch { }
    finally { setSearchLoading(false); }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onSearch?.(value);
    if (!value.trim()) {
      setShowSearchDropdown(false);
      setSearchResults([]);
      return;
    }
    setShowSearchDropdown(true);
    // Instant page search
    const pages = searchPages(value);
    setSearchResults(pages);
    // Debounce data search
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => searchData(value), 300);
  };

  const handleSearchResultClick = (result: SearchResult) => {
    setShowSearchDropdown(false);
    setSearchQuery('');
    setSearchResults([]);
    router.push(result.href);
  };

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Notification sound using Web Audio API
  const playNotificationSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + start + 0.02);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + duration);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };
      playTone(587, 0, 0.12);     // D5
      playTone(784, 0.1, 0.12);   // G5
      playTone(1047, 0.2, 0.15);  // C6
      setTimeout(() => ctx.close(), 500);
    } catch { }
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications?limit=50');
      const data = await res.json();
      const newUnread = data.unreadCount || 0;

      // Play sound if unread count increased
      if (prevUnreadRef.current !== null && newUnread > prevUnreadRef.current) {
        playNotificationSound();
      }
      prevUnreadRef.current = newUnread;

      setNotifications(data.notifications || []);
      setUnreadCount(newUnread);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true, to: 'admin' }),
      });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch { }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const typeIcon: Record<string, string> = {
    product_request: '📦',
    product_update: '📦',
    order_response: '📋',
    order_assigned: '🔔',
    order_cancelled: '❌',
    dispatch_action: '🚚',
    support_message: '💬',
    password_change: '🔑',
    price_update: '💰',
    quantity_update: '📊',
    low_stock: '⚠️',
    payment_update: '💳',
    return_request: '↩️',
    return_action: '↩️',
  };

  const getDefaultLink = (type: string) => {
    const map: Record<string, string> = {
      product_request: '/admin/submissions',
      product_update: '/admin/product-updates',
      low_stock: '/admin/products',
      order_response: '/admin/order-acceptance',
      order_assigned: '/admin/orders',
      order_cancelled: '/admin/order-history',
      dispatch_action: '/admin/deliveries',
      support_message: '/admin/support',
      password_change: '/admin/settings',
      price_update: '/admin/submissions',
      quantity_update: '/admin/submissions',
      payment_update: '/admin/payments',
      return_request: '/admin/returns',
      return_action: '/admin/returns',
    };
    return map[type] || '/admin';
  };

  const handleNotificationClick = async (n: any) => {
    // Mark as read
    if (!n.isRead) {
      try {
        await fetch('/api/notifications', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: n._id }),
        });
        setNotifications(prev => prev.map(item => item._id === n._id ? { ...item, isRead: true } : item));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch { }
    }
    setShowNotifications(false);
    const link = n.link || getDefaultLink(n.type);
    router.push(link);
  };

  // About NEXUS
  const openAbout = async () => {
    setShowAbout(true);
    setAboutEditing(false);
    setAboutLoading(true);
    try {
      const res = await fetch('/api/company-info');
      const data = await res.json();
      setCompanyInfo(data.info);
      setAboutForm(data.info || {});
    } catch { }
    finally { setAboutLoading(false); }
  };

  const saveAbout = async () => {
    setAboutSaving(true);
    try {
      const res = await fetch('/api/company-info', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aboutForm),
      });
      if (res.ok) {
        const data = await res.json();
        setCompanyInfo(data.info);
        setAboutEditing(false);
      }
    } catch { }
    finally { setAboutSaving(false); }
  };

  const inputClass = "w-full px-3 py-2 bg-white/5 border-2 border-white/10 text-sm text-white focus:outline-none focus:border-accent transition-all placeholder-white/20";

  return (
    <>
      <header className="h-16 bg-dark/80 backdrop-blur-md border-b-2 border-white/10 flex items-center justify-between px-6 sticky top-0 z-40 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <h1 className="font-display text-lg font-bold tracking-tighter">
            <span className="text-accent">NX</span> OS
          </h1>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-xl mx-8" ref={searchContainerRef}>
          <div className="relative group">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="SEARCH COMMANDS..."
              className="w-full pl-10 pr-4 py-2 bg-white/5 border-2 border-white/10 text-xs text-white font-display focus:outline-none focus:border-accent transition-all placeholder-white/30"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => { if (searchQuery.trim()) setShowSearchDropdown(true); }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setShowSearchDropdown(false); }
                if (e.key === 'Enter' && searchResults.length > 0) { handleSearchResultClick(searchResults[0]); }
              }}
            />

            {/* Search Dropdown */}
            {showSearchDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#111] border-2 border-white/20 z-[60] overflow-hidden max-h-[400px] overflow-y-auto">
                {searchResults.length === 0 && !searchLoading && (
                  <div className="p-4 text-center text-xs text-white/40 font-display uppercase tracking-wider">No results</div>
                )}
                {searchLoading && searchResults.filter(r => r.type !== 'page').length === 0 && (
                  <div className="p-3 text-center">
                    <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
                  </div>
                )}
                {(() => {
                  const groups: { type: string; title: string; icon: string }[] = [
                    { type: 'page', title: 'Pages', icon: '📄' },
                    { type: 'order', title: 'Orders', icon: '📋' },
                    { type: 'product', title: 'Products', icon: '📦' },
                    { type: 'supplier', title: 'Suppliers', icon: '🏢' },
                  ];
                  return groups.map(g => {
                    const items = searchResults.filter(r => r.type === g.type);
                    if (items.length === 0) return null;
                    return (
                      <div key={g.type}>
                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/30 bg-white/5 border-b border-white/10 font-display">
                          {g.icon} {g.title}
                        </div>
                        {items.map((item, i) => (
                          <div key={`${g.type}-${i}`} onClick={() => handleSearchResultClick(item)}
                            className="px-3 py-2.5 hover:bg-accent/10 hover:text-accent cursor-pointer transition-colors border-b border-white/5 last:border-0">
                            <p className="text-sm font-medium">{item.label}</p>
                            {item.sublabel && <p className="text-xs text-white/40 mt-0.5">{item.sublabel}</p>}
                          </div>
                        ))}
                      </div>
                    );
                  });
                })()}
                {searchLoading && searchResults.length > 0 && (
                  <div className="px-3 py-2 text-center text-[10px] text-white/40 border-t border-white/10 font-display uppercase tracking-wider">Searching...</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Notifications */}
          <div className="relative">
            <button
              className="relative p-2 border-2 border-white/10 bg-white/5 hover:bg-white hover:text-black transition-all"
              onClick={() => { setShowNotifications(!showNotifications); setNotifTab('notifications'); }}
              title="Notifications"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full border-2 border-dark" />
              )}
            </button>

            {showNotifications && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                <div className="absolute right-0 top-full mt-2 w-96 bg-[#111] border-2 border-white/20 z-50 overflow-hidden">
                  {/* Tabs */}
                  <div className="flex border-b border-white/10">
                    <button
                      onClick={() => setNotifTab('notifications')}
                      className={`flex-1 px-4 py-3 text-xs font-display uppercase tracking-widest transition-colors relative ${notifTab === 'notifications' ? 'text-accent' : 'text-white/50 hover:text-white'}`}
                    >
                      Alerts
                      {unreadCount > 0 && (
                        <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] bg-accent text-black text-[10px] font-bold px-1">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                      {notifTab === 'notifications' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent" />}
                    </button>
                    <button
                      onClick={() => setNotifTab('history')}
                      className={`flex-1 px-4 py-3 text-xs font-display uppercase tracking-widest transition-colors relative ${notifTab === 'history' ? 'text-accent' : 'text-white/50 hover:text-white'}`}
                    >
                      History
                      {notifTab === 'history' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent" />}
                    </button>
                  </div>

                  {/* Mark all read */}
                  {notifTab === 'notifications' && unreadCount > 0 && (
                    <div className="px-4 py-2 border-b border-white/10 flex justify-end">
                      <button onClick={handleMarkAllRead} className="text-[10px] text-accent hover:underline bg-transparent border-none cursor-pointer uppercase tracking-widest font-display">Mark all read</button>
                    </div>
                  )}

                  {/* Notification list */}
                  <div className="max-h-96 overflow-y-auto">
                    {(() => {
                      const filtered = notifTab === 'notifications'
                        ? notifications.filter(n => !n.isRead)
                        : notifications.filter(n => n.isRead);

                      if (filtered.length === 0) {
                        return (
                          <div className="p-8 text-center">
                            <div className="text-3xl mb-2">{notifTab === 'notifications' ? '🔔' : '📋'}</div>
                            <p className="text-xs text-white/40 font-display uppercase tracking-wider">
                              {notifTab === 'notifications' ? 'No new alerts' : 'No history'}
                            </p>
                          </div>
                        );
                      }

                      return filtered.map((n: any) => (
                        <div key={n._id} onClick={() => handleNotificationClick(n)} className={`px-4 py-3 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors ${!n.isRead ? 'bg-accent/5' : ''}`}>
                          <div className="flex items-start gap-2.5">
                            <span className="text-lg shrink-0 mt-0.5">{typeIcon[n.type] || '🔔'}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white">{n.title}</p>
                              <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{n.message}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {n.fromName && <span className="text-[10px] text-white/30">{n.fromName}</span>}
                                <span className="text-[10px] text-white/30">{timeAgo(n.createdAt)}</span>
                              </div>
                            </div>
                            {!n.isRead && <span className="w-2 h-2 bg-accent mt-1.5 shrink-0" />}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Profile / About */}
          <button onClick={openAbout} className="w-8 h-8 border-2 border-white flex items-center justify-center text-white text-xs font-display font-bold cursor-pointer hover:bg-white hover:text-black transition-all" title="About NEXUS">
            N
          </button>
        </div>
      </header>

      {/* About NEXUS Modal */}
      {showAbout && (
        <>
          <div className="fixed inset-0 bg-black z-[1000]" onClick={() => !aboutSaving && setShowAbout(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-[1001] pointer-events-none">
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#111] border-2 border-white/20 pointer-events-auto" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 border-2 border-accent flex items-center justify-center text-accent text-sm font-display font-bold">N</div>
                  <div>
                    <h2 className="text-lg font-bold text-white">{aboutEditing ? 'Edit Company Info' : (companyInfo?.name || 'NEXUS')}</h2>
                    {!aboutEditing && companyInfo?.tagline && <p className="text-xs text-white/40">{companyInfo.tagline}</p>}
                  </div>
                </div>
                <button onClick={() => setShowAbout(false)} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 text-white/40 hover:text-white text-xl transition-colors">&times;</button>
              </div>

              <div className="p-5">
                {aboutLoading ? (
                  <div className="py-12 text-center">
                    <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-sm text-white/40">Loading...</p>
                  </div>
                ) : aboutEditing ? (
                  /* Edit Form */
                  <div className="space-y-4">
                    <div>
                      <label className="block mb-1 text-[10px] text-white/50 font-display uppercase tracking-widest font-bold">Company Name</label>
                      <input type="text" className={inputClass} value={aboutForm.name || ''} onChange={e => setAboutForm({ ...aboutForm, name: e.target.value })} />
                    </div>
                    <div>
                      <label className="block mb-1 text-[10px] text-white/50 font-display uppercase tracking-widest font-bold">Tagline</label>
                      <input type="text" className={inputClass} value={aboutForm.tagline || ''} onChange={e => setAboutForm({ ...aboutForm, tagline: e.target.value })} placeholder="Short tagline" />
                    </div>
                    <div>
                      <label className="block mb-1 text-[10px] text-white/50 font-display uppercase tracking-widest font-bold">Description</label>
                      <textarea className={inputClass} rows={3} value={aboutForm.description || ''} onChange={e => setAboutForm({ ...aboutForm, description: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block mb-1 text-[10px] text-white/50 font-display uppercase tracking-widest font-bold">Email</label>
                        <input type="email" className={inputClass} value={aboutForm.email || ''} onChange={e => setAboutForm({ ...aboutForm, email: e.target.value })} />
                      </div>
                      <div>
                        <label className="block mb-1 text-[10px] text-white/50 font-display uppercase tracking-widest font-bold">Phone</label>
                        <input type="text" className={inputClass} value={aboutForm.phone || ''} onChange={e => setAboutForm({ ...aboutForm, phone: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block mb-1 text-[10px] text-white/50 font-display uppercase tracking-widest font-bold">Website</label>
                        <input type="url" className={inputClass} value={aboutForm.website || ''} onChange={e => setAboutForm({ ...aboutForm, website: e.target.value })} />
                      </div>
                      <div>
                        <label className="block mb-1 text-[10px] text-white/50 font-display uppercase tracking-widest font-bold">GST Number</label>
                        <input type="text" className={inputClass} value={aboutForm.gst || ''} onChange={e => setAboutForm({ ...aboutForm, gst: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <label className="block mb-1 text-[10px] text-white/50 font-display uppercase tracking-widest font-bold">Address</label>
                      <textarea className={inputClass} rows={2} value={aboutForm.address || ''} onChange={e => setAboutForm({ ...aboutForm, address: e.target.value })} />
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                      <button onClick={() => { setAboutEditing(false); setAboutForm(companyInfo || {}); }} className="px-4 py-2 bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors">Cancel</button>
                      <button onClick={saveAbout} disabled={aboutSaving} className="px-4 py-2 bg-accent text-black text-sm font-bold hover:bg-accent/80 disabled:opacity-70 transition-colors">
                        {aboutSaving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Read-only View */
                  <div className="space-y-4">
                    {companyInfo?.description && (
                      <p className="text-sm text-white/60 leading-relaxed">{companyInfo.description}</p>
                    )}

                    <div className="grid grid-cols-1 gap-3">
                      {companyInfo?.email && (
                        <div className="flex items-center gap-3 bg-white/5 p-3 border border-white/10">
                          <span className="text-lg">📧</span>
                          <div>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest font-display">Email</p>
                            <p className="text-sm text-white font-medium">{companyInfo.email}</p>
                          </div>
                        </div>
                      )}
                      {companyInfo?.phone && (
                        <div className="flex items-center gap-3 bg-white/5 p-3 border border-white/10">
                          <span className="text-lg">📞</span>
                          <div>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest font-display">Phone</p>
                            <p className="text-sm text-white font-medium">{companyInfo.phone}</p>
                          </div>
                        </div>
                      )}
                      {companyInfo?.website && (
                        <div className="flex items-center gap-3 bg-white/5 p-3 border border-white/10">
                          <span className="text-lg">🌐</span>
                          <div>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest font-display">Website</p>
                            <a href={companyInfo.website} target="_blank" rel="noopener noreferrer" className="text-sm text-accent font-medium hover:underline">{companyInfo.website}</a>
                          </div>
                        </div>
                      )}
                      {companyInfo?.address && (
                        <div className="flex items-center gap-3 bg-white/5 p-3 border border-white/10">
                          <span className="text-lg">📍</span>
                          <div>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest font-display">Address</p>
                            <p className="text-sm text-white font-medium">{companyInfo.address}</p>
                          </div>
                        </div>
                      )}
                      {companyInfo?.gst && (
                        <div className="flex items-center gap-3 bg-white/5 p-3 border border-white/10">
                          <span className="text-lg">🏢</span>
                          <div>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest font-display">GST Number</p>
                            <p className="text-sm text-white font-mono font-medium">{companyInfo.gst}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Admin Edit Button */}
                    <div className="pt-3 border-t border-white/10">
                      <button onClick={() => setAboutEditing(true)} className="w-full px-4 py-2 text-sm bg-white/5 border-2 border-white/10 text-white font-display text-xs uppercase tracking-widest hover:border-accent hover:text-accent transition-colors">
                        Edit Company Info
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
