'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import KPICard from '../../components/KPICard';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import AlertsPanel from '../../components/AlertsPanel';

interface Analytics {
  kpis: {
    totalOrders: number; todaysOrders: number; pendingOrders: number;
    fulfilledOrders: number; cancelledOrders: number; refundedOrders: number;
    codOrders: number; paidOrders: number;
    totalRevenue: number; todaysRevenue: number; weeklyRevenue: number; monthlyRevenue: number;
    productCount: number; customerCount: number;
  };
  topProducts: { title: string; qty: number; revenue: number }[];
  dailyRevenue: { date: string; revenue: number; orders: number }[];
}

function formatCurrency(val: number) {
  return '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function AdminDashboardOverview() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [supplierStats, setSupplierStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [firebaseUsers, setFirebaseUsers] = useState<Record<string, any>>({});

  useEffect(() => {
    async function fetchData() {
      try {
        const [analyticsRes, ordersRes, supplierRes, fbUsersRes] = await Promise.all([
          fetch('/api/shopify/analytics'),
          fetch('/api/shopify/orders?limit=10'),
          fetch('/api/supplier-orders?limit=500'),
          fetch('/api/firebase-users'),
        ]);
        const analyticsData = await analyticsRes.json();
        const ordersData = await ordersRes.json();
        const supplierData = await supplierRes.json();
        const fbData = await fbUsersRes.json();
        setAnalytics(analyticsData);
        setOrders(ordersData.orders || []);

        // Build phone + uid -> user lookup
        const lookup: Record<string, any> = {};
        (fbData.users || []).forEach((u: any) => {
          if (u.uid) lookup[u.uid] = u;
          if (u.phone) {
            lookup[u.phone] = u;
            const stripped = u.phone.replace(/^\+91/, '').replace(/^0/, '').replace(/\s/g, '');
            lookup[stripped] = u;
            lookup['+91' + stripped] = u;
            const digits = u.phone.replace(/\D/g, '');
            if (digits.length >= 10) lookup[digits.slice(-10)] = u;
          }
        });
        setFirebaseUsers(lookup);

        // Calculate supplier stats
        const sOrders = supplierData.orders || [];
        setSupplierStats({
          total: sOrders.length,
          pending: sOrders.filter((o: any) => o.status === 'pending').length,
          activeDeliveries: sOrders.filter((o: any) => ['delivery_boy_coming', 'given_to_delivery', 'in_transit'].includes(o.status)).length,
          completed: sOrders.filter((o: any) => o.status === 'completed').length,
          totalQuoted: sOrders.reduce((s: number, o: any) => s + (o.supplierReply?.totalAmount || 0), 0),
          unpaid: sOrders.filter((o: any) => o.paymentStatus !== 'paid' && o.supplierReply?.totalAmount).length,
        });
      } catch (err) { console.error('Dashboard fetch error:', err); }
      finally { setLoading(false); }
    }
    fetchData();
  }, []);

  // Resolve customer from Firebase
  const resolveCustomer = (order: any) => {
    const phone = order.shipping_address?.phone
      || order.billing_address?.phone
      || order.customer?.phone
      || order.phone || '';

    const noteUidMatch = (order.note || '').match(/Firebase UID:\s*(\S+)/);
    const firebaseUid = noteUidMatch?.[1] || '';

    const normalize = (p: string) => {
      const digits = (p || '').replace(/\D/g, '');
      return digits.length >= 10 ? digits.slice(-10) : digits;
    };

    if (phone) {
      const phoneNorm = normalize(phone);
      const fbUser = firebaseUsers[phone]
        || firebaseUsers['+91' + phoneNorm]
        || firebaseUsers[phoneNorm]
        || Object.values(firebaseUsers).find((u: any) => u.phone && normalize(u.phone) === phoneNorm);
      if (fbUser) {
        return fbUser.displayName || fbUser.email || fbUser.phone || phone;
      }
    }
    if (firebaseUid) {
      const fbUser = Object.values(firebaseUsers).find((u: any) => u.uid === firebaseUid);
      if (fbUser) return (fbUser as any).displayName || (fbUser as any).email || (fbUser as any).phone || phone;
    }

    const shopifyName = order.customer
      ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : '';
    const shippingName = order.shipping_address
      ? `${order.shipping_address.first_name || ''} ${order.shipping_address.last_name || ''}`.trim() : '';
    return shopifyName || shippingName || phone || 'Guest';
  };

  const kpis = analytics?.kpis;
  const kpiData = kpis ? [
    { title: "Today's Orders", value: kpis.todaysOrders, color: 'blue' as const, href: '/admin/orders', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> },
    { title: 'Weekly Revenue', value: formatCurrency(kpis.weeklyRevenue), color: 'emerald' as const, href: '/admin/reports', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { title: 'Customers', value: kpis.customerCount.toLocaleString(), color: 'purple' as const, href: '/admin/users', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg> },
    { title: 'Products', value: kpis.productCount, color: 'indigo' as const, href: '/admin/products', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg> },
    { title: 'Pending Orders', value: kpis.pendingOrders, color: 'amber' as const, href: '/admin/orders', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { title: 'Total Revenue', value: formatCurrency(kpis.totalRevenue), color: 'blue' as const, href: '/admin/reports', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
  ] : [];

  // Build alerts from real data
  const alerts = kpis ? [
    ...(kpis.pendingOrders > 0 ? [{ id: 1, type: 'warning' as const, message: `${kpis.pendingOrders} orders pending fulfillment`, time: 'Now' }] : []),
    ...(kpis.cancelledOrders > 0 ? [{ id: 2, type: 'error' as const, message: `${kpis.cancelledOrders} orders cancelled across all time`, time: '' }] : []),
    ...(kpis.refundedOrders > 0 ? [{ id: 3, type: 'info' as const, message: `${kpis.refundedOrders} orders have been refunded`, time: '' }] : []),
    { id: 4, type: 'success' as const, message: `${kpis.fulfilledOrders} orders fulfilled successfully`, time: '' },
  ] : [];

  // Map Shopify orders to table format with Firebase names
  const recentOrders = useMemo(() => orders.map((o: any) => ({
    id: o.name || `#${o.id}`,
    _raw: o,
    customer: resolveCustomer(o),
    amount: formatCurrency(parseFloat(o.total_price || 0)),
    status: o.fulfillment_status ? o.fulfillment_status.charAt(0).toUpperCase() + o.fulfillment_status.slice(1) : 'Unfulfilled',
    payment: o.financial_status ? o.financial_status.charAt(0).toUpperCase() + o.financial_status.slice(1) : 'Pending',
    date: new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [orders, firebaseUsers]);

  const orderColumns = [
    { key: 'id', label: 'Order', render: (val: string) => <span className="font-bold text-accent">{val}</span> },
    { key: 'customer', label: 'Customer' },
    { key: 'amount', label: 'Amount', sortable: true },
    { key: 'date', label: 'Date' },
    { key: 'payment', label: 'Payment' },
    { key: 'status', label: 'Status', render: (val: string) => <StatusBadge status={val} /> },
  ];

  // Daily revenue for chart
  const dailyRevenue = analytics?.dailyRevenue || [];
  const maxRev = Math.max(...dailyRevenue.map(d => d.revenue), 1);

  if (loading) {
    return (
      <div>
        <h1 className="font-display text-lg font-bold uppercase tracking-widest text-white mb-6">Dashboard</h1>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white/5 border-2 border-white/10 p-5 animate-pulse"><div className="h-4 bg-white/10 rounded w-2/3 mb-2" /><div className="h-6 bg-white/10 rounded w-1/2" /></div>
          ))}
        </div>
        <div className="bg-white/5 border-2 border-white/10 p-6 animate-pulse"><div className="h-4 bg-white/10 rounded w-1/4 mb-4" /><div className="h-40 bg-white/5 rounded" /></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-display text-lg font-bold uppercase tracking-widest text-white">Dashboard Overview</h1>
          <p className="text-xs text-white/40 mt-1">Live data from Shopify — platform overview</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {kpiData.map((kpi, i) => (
          <div key={i} onClick={() => kpi.href && router.push(kpi.href)} className={kpi.href ? 'cursor-pointer' : ''}>
            <KPICard {...kpi} />
          </div>
        ))}
      </div>

      {/* Supplier Workflow KPIs */}
      {supplierStats && (
        <div className="mb-8">
          <h3 className="text-[10px] font-display font-bold text-white/40 uppercase tracking-widest mb-3">Supplier Workflow</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {[
              { title: 'Assigned', value: supplierStats.total, color: 'bg-blue-500', href: '/admin/order-acceptance' },
              { title: 'Pending', value: supplierStats.pending, color: 'bg-yellow-500', href: '/admin/order-acceptance' },
              { title: 'Active', value: supplierStats.activeDeliveries, color: 'bg-cyan-500', href: '/admin/deliveries' },
              { title: 'Completed', value: supplierStats.completed, color: 'bg-green-500', href: '/admin/order-history' },
              { title: 'Quoted', value: formatCurrency(supplierStats.totalQuoted), color: 'bg-purple-500', href: '/admin/payments' },
              { title: 'Unpaid', value: supplierStats.unpaid, color: 'bg-red-500', href: '/admin/payments' },
            ].map((s, i) => (
              <div key={i} onClick={() => router.push(s.href)} className="bg-white/5 border-2 border-white/10 p-4 cursor-pointer hover:border-white/20 transition-all">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-1.5 h-1.5 ${s.color}`} />
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-display font-bold">{s.title}</p>
                </div>
                <p className="text-xl font-black text-white tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Top Products */}
        <div onClick={() => router.push('/admin/products')} className="bg-white/5 border-2 border-white/10 p-6 cursor-pointer hover:border-white/20 transition-all h-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-display font-bold uppercase tracking-widest text-white">Top Products</h3>
            <span className="text-[10px] text-accent font-display font-bold uppercase tracking-wider">View All</span>
          </div>
          <div className="space-y-3">
            {(analytics?.topProducts || []).slice(0, 5).map((p, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-white/60 truncate mr-2">{p.title}</span>
                  <span className="font-bold text-white shrink-0">{formatCurrency(p.revenue)}</span>
                </div>
                <div className="w-full bg-white/10 h-1.5">
                  <div className="h-1.5 bg-accent" style={{ width: `${Math.min(100, (p.revenue / (analytics?.topProducts?.[0]?.revenue || 1)) * 100)}%` }} />
                </div>
              </div>
            ))}
            {(!analytics?.topProducts || analytics.topProducts.length === 0) && <p className="text-xs text-white/40">No sales data yet</p>}
          </div>
        </div>

        {/* Order Status Breakdown */}
        <div onClick={() => router.push('/admin/orders')} className="bg-white/5 border-2 border-white/10 p-6 cursor-pointer hover:border-white/20 transition-all h-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-display font-bold uppercase tracking-widest text-white">Order Breakdown</h3>
            <span className="text-[10px] text-accent font-display font-bold uppercase tracking-wider">View All</span>
          </div>
          <div className="space-y-3">
            {kpis && [
              { name: 'Fulfilled', count: kpis.fulfilledOrders, color: 'bg-green-500' },
              { name: 'Pending', count: kpis.pendingOrders, color: 'bg-yellow-500' },
              { name: 'Cancelled', count: kpis.cancelledOrders, color: 'bg-red-500' },
              { name: 'Refunded', count: kpis.refundedOrders, color: 'bg-purple-500' },
              { name: 'COD', count: kpis.codOrders, color: 'bg-blue-500' },
            ].map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 ${item.color}`} />
                  <span className="text-sm text-white/60">{item.name}</span>
                </div>
                <span className="text-sm font-black text-white tabular-nums">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Revenue Chart */}
        <div onClick={() => router.push('/admin/reports')} className="bg-white/5 border-2 border-white/10 p-6 cursor-pointer hover:border-white/20 transition-all h-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-display font-bold uppercase tracking-widest text-white">Revenue (7 Days)</h3>
            <span className="text-[10px] text-accent font-display font-bold uppercase tracking-wider">Report</span>
          </div>
          <div className="h-40 flex items-end justify-center gap-1.5">
            {dailyRevenue.map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-1 flex-1">
                <span className="text-[9px] text-white/40 font-bold">{d.orders}</span>
                <div className="w-full max-w-[28px] bg-accent hover:bg-accent/80 transition-all" style={{ height: `${Math.max(4, (d.revenue / maxRev) * 120)}px` }} />
                <span className="text-[10px] text-white/30">{new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short' })}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table + Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-display font-bold uppercase tracking-widest text-white">Recent Orders</h3>
            <button onClick={() => router.push('/admin/orders')} className="text-[10px] text-accent font-display font-bold uppercase tracking-wider hover:underline bg-transparent border-none cursor-pointer">
              View All
            </button>
          </div>
          <DataTable columns={orderColumns} data={recentOrders} onRowClick={() => router.push('/admin/orders')} />
        </div>
        <div>
          <AlertsPanel title="Status Summary" alerts={alerts} />
        </div>
      </div>
    </div>
  );
}
