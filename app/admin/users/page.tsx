'use client';

import { useState, useEffect, useMemo } from 'react';
import DataTable from '../../../components/DataTable';
import StatusBadge from '../../../components/StatusBadge';
import FilterBar from '../../../components/FilterBar';
import Modal from '../../../components/Modal';

function formatDate(dateStr: string | null) {
 if (!dateStr) return '—';
 return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function timeAgo(dateStr: string | null) {
 if (!dateStr) return '—';
 const diff = Date.now() - new Date(dateStr).getTime();
 const m = Math.floor(diff / 60000);
 if (m < 1) return 'Just now';
 if (m < 60) return `${m}m ago`;
 const h = Math.floor(m / 60);
 if (h < 24) return `${h}h ago`;
 const d = Math.floor(h / 24);
 if (d < 30) return `${d}d ago`;
 return formatDate(dateStr);
}

export default function AdminUsersPage() {
 const [users, setUsers] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [filters, setFilters] = useState<Record<string, string>>({});

 // Modal state for viewing user orders
 const [selectedUser, setSelectedUser] = useState<any>(null);
 const [orderData, setOrderData] = useState<{ customer: any; orders: any[] } | null>(null);
 const [ordersLoading, setOrdersLoading] = useState(false);

 useEffect(() => {
 async function fetchUsers() {
 try {
 const res = await fetch('/api/firebase-users');
 const data = await res.json();
 setUsers(data.users || []);
 } catch (err) { console.error(err); }
 finally { setLoading(false); }
 }
 fetchUsers();
 }, []);

 // Fetch orders when a user is selected
 const handleUserClick = async (row: any) => {
 const user = users.find(u => u.uid === row.uid);
 if (!user?.phone) return;

 setSelectedUser(user);
 setOrderData(null);
 setOrdersLoading(true);

 try {
 const res = await fetch(`/api/user-orders?phone=${encodeURIComponent(user.phone)}`);
 const data = await res.json();
 setOrderData({ customer: data.customer, orders: data.orders || [] });
 } catch (err) {
 console.error(err);
 setOrderData({ customer: null, orders: [] });
 } finally {
 setOrdersLoading(false);
 }
 };

 // Sort option
 const [sortBy, setSortBy] = useState<string>('newest');

 // Filter + sort users
 const filteredUsers = useMemo(() => {
 let result = [...users];

 // Text search
 const search = (filters.search || '').toLowerCase();
 if (search) {
 result = result.filter(u =>
 (u.phone || '').toLowerCase().includes(search) ||
 (u.email || '').toLowerCase().includes(search) ||
 (u.displayName || '').toLowerCase().includes(search) ||
 (u.uid || '').toLowerCase().includes(search)
 );
 }

 // Date range filter — "from" date
 if (filters.dateFrom) {
 const from = new Date(filters.dateFrom);
 from.setHours(0, 0, 0, 0);
 result = result.filter(u => u.createdAt && new Date(u.createdAt) >= from);
 }

 // Date range filter — "to" date
 if (filters.dateTo) {
 const to = new Date(filters.dateTo);
 to.setHours(23, 59, 59, 999);
 result = result.filter(u => u.createdAt && new Date(u.createdAt) <= to);
 }

 // Sort
 result.sort((a, b) => {
 switch (sortBy) {
 case 'newest':
 return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
 case 'oldest':
 return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
 case 'lastActive':
 return new Date(b.lastSignIn || 0).getTime() - new Date(a.lastSignIn || 0).getTime();
 case 'nameAZ':
 return (a.displayName || a.phone || '').localeCompare(b.displayName || b.phone || '');
 default:
 return 0;
 }
 });

 return result;
 }, [users, filters, sortBy]);

 const tableData = filteredUsers.map((u: any) => ({
 uid: u.uid,
 phone: u.phone || '—',
 email: u.email || '—',
 name: u.displayName || '—',
 provider: u.providerId === 'phone' ? 'Phone OTP' : u.providerId || 'Phone OTP',
 status: u.disabled ? 'Disabled' : 'Active',
 joined: formatDate(u.createdAt),
 _joinedRaw: u.createdAt || '',
 lastLogin: timeAgo(u.lastSignIn),
 _lastLoginRaw: u.lastSignIn || '',
 }));

 const columns = [
 { key: 'phone', label: 'Phone', render: (val: string) => <span className="font-semibold text-accent">{val}</span> },
 { key: 'name', label: 'Name', sortable: true },
 { key: 'email', label: 'Email', render: (val: string) => <span className="text-sm text-white/50">{val}</span> },
 { key: 'provider', label: 'Auth Method', render: (val: string) => (
 <span className="inline-flex items-center gap-1 text-xs font-medium text-white/60 bg-white/10 px-2 py-0.5 rounded-full">{val}</span>
 )},
 { key: 'joined', label: 'Joined', sortable: true },
 { key: 'lastLogin', label: 'Last Active', sortable: true },
 { key: 'status', label: 'Status', render: (val: string) => <StatusBadge status={val} /> },
 ];

 const filterConfig = [
 { key: 'search', label: 'Search', type: 'text' as const, placeholder: 'Search by phone, email, name...' },
 { key: 'dateFrom', label: 'From', type: 'date' as const },
 { key: 'dateTo', label: 'To', type: 'date' as const },
 ];

 // Stats
 const totalUsers = users.length;
 const activeUsers = users.filter(u => !u.disabled).length;
 const recentUsers = users.filter(u => {
 if (!u.lastSignIn) return false;
 return (Date.now() - new Date(u.lastSignIn).getTime()) < 7 * 24 * 60 * 60 * 1000;
 }).length;
 const phoneUsers = users.filter(u => u.phone).length;

 // Users in filtered date range
 const filteredCount = filteredUsers.length;

 return (
 <div>
 <div className="mb-6">
 <h1 className="text-2xl font-bold text-white">Users</h1>
 <p className="text-sm text-white/50 mt-1">All registered users from Firebase Auth. Click a user to view their Shopify orders.</p>
 </div>

 {/* KPI Stats */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
 <div className="bg-white/5 border-2 border-white/10 p-4 ">
 <p className="text-2xl font-bold text-accent">{totalUsers}</p>
 <p className="text-xs text-white/50 mt-1">Total Users</p>
 </div>
 <div className="bg-white/5 border-2 border-white/10 p-4 ">
 <p className="text-2xl font-bold text-green-400">{activeUsers}</p>
 <p className="text-xs text-white/50 mt-1">Active Accounts</p>
 </div>
 <div className="bg-white/5 border-2 border-white/10 p-4 ">
 <p className="text-2xl font-bold text-indigo-400">{recentUsers}</p>
 <p className="text-xs text-white/50 mt-1">Active This Week</p>
 </div>
 <div className="bg-white/5 border-2 border-white/10 p-4 ">
 <p className="text-2xl font-bold text-yellow-400">{phoneUsers}</p>
 <p className="text-xs text-white/50 mt-1">Phone Verified</p>
 </div>
 </div>

 {/* Filters + Sort Row */}
 <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 mb-1">
 <div className="flex-1 w-full">
 <FilterBar filters={filterConfig} onFilterChange={setFilters} />
 </div>
 <div className="flex items-center gap-2 mb-4">
 <label className="text-xs text-white/40 whitespace-nowrap">Sort by</label>
 <select
 value={sortBy}
 onChange={e => setSortBy(e.target.value)}
 className="px-3 py-2 bg-white/5 border-2 border-white/10 text-sm focus:outline-none focus:border-accent min-w-[160px]"
 >
 <option value="newest">Newest First</option>
 <option value="oldest">Oldest First</option>
 <option value="lastActive">Last Active</option>
 <option value="nameAZ">Name A → Z</option>
 </select>
 </div>
 </div>

 {/* Showing count when filtered */}
 {(filters.dateFrom || filters.dateTo || filters.search) && (
 <p className="text-xs text-white/40 mb-3">Showing {filteredCount} of {totalUsers} users</p>
 )}

 <DataTable
 columns={columns}
 data={tableData}
 loading={loading}
 emptyMessage="No users found."
 onRowClick={handleUserClick}
 pageSize={15}
 />

 {/* Order Details Modal */}
 <Modal
 isOpen={!!selectedUser}
 onClose={() => { setSelectedUser(null); setOrderData(null); }}
 title={`Orders — ${selectedUser?.phone || ''}`}
 size="xl"
 >
 <div>
 {/* User Info Header */}
 <div className="bg-white/5 p-4 mb-5 border-2 border-white/5">
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
 <div>
 <p className="text-white/40 text-xs">Name</p>
 <p className="font-semibold text-white">{selectedUser?.displayName || '—'}</p>
 </div>
 <div>
 <p className="text-white/40 text-xs">Phone</p>
 <p className="font-semibold text-white">{selectedUser?.phone || '—'}</p>
 </div>
 <div>
 <p className="text-white/40 text-xs">Joined</p>
 <p className="font-medium text-white/80">{formatDate(selectedUser?.createdAt)}</p>
 </div>
 <div>
 <p className="text-white/40 text-xs">Last Sign In</p>
 <p className="font-medium text-white/80">{timeAgo(selectedUser?.lastSignIn)}</p>
 </div>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-3 pt-3 border-t border-white/10">
 <div className="min-w-0">
 <p className="text-white/40 text-xs">Email</p>
 <p className="font-medium text-white/80 truncate" title={selectedUser?.email || '—'}>{selectedUser?.email || '—'}</p>
 </div>
 <div className="min-w-0">
 <p className="text-white/40 text-xs">Firebase UID</p>
 <p className="font-mono text-xs text-white/50 truncate" title={selectedUser?.uid}>{selectedUser?.uid}</p>
 </div>
 </div>
 </div>

 {/* Shopify Customer Info */}
 {orderData?.customer && (
 <div className="bg-accent/10 p-4 mb-5 border border-accent/20">
 <p className="text-xs font-semibold text-blue-700 mb-2">Shopify Customer</p>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
 <div>
 <p className="text-blue-400 text-xs">Name</p>
 <p className="font-semibold text-blue-800">{orderData.customer.name || '—'}</p>
 </div>
 <div>
 <p className="text-blue-400 text-xs">Email</p>
 <p className="text-blue-700">{orderData.customer.email || '—'}</p>
 </div>
 <div>
 <p className="text-blue-400 text-xs">Total Orders</p>
 <p className="font-bold text-blue-800">{orderData.customer.ordersCount || 0}</p>
 </div>
 <div>
 <p className="text-blue-400 text-xs">Total Spent</p>
 <p className="font-bold text-blue-800">₹{parseFloat(orderData.customer.totalSpent || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
 </div>
 </div>
 </div>
 )}

 {/* Loading State */}
 {ordersLoading && (
 <div className="flex items-center justify-center py-12">
 <div className="flex items-center gap-3 text-white/50">
 <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
 </svg>
 Fetching orders from Shopify...
 </div>
 </div>
 )}

 {/* No Orders */}
 {!ordersLoading && orderData && orderData.orders.length === 0 && (
 <div className="text-center py-10">
 <svg className="w-12 h-12 mx-auto text-gray-200 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
 </svg>
 <p className="text-white/40 text-sm">No orders found for this user on Shopify.</p>
 {!orderData.customer && (
 <p className="text-white/40 text-xs mt-1">This phone number doesn't have a Shopify account.</p>
 )}
 </div>
 )}

 {/* Orders List */}
 {!ordersLoading && orderData && orderData.orders.length > 0 && (
 <div className="space-y-3">
 <p className="text-sm font-semibold text-white/60 mb-2">{orderData.orders.length} order(s) found</p>
 {orderData.orders.map((order: any) => (
 <div key={order.id} className="bg-white/5 border-2 border-white/10 p-4 hover: transition-shadow">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-3">
 <span className="font-bold text-accent text-sm">{order.name}</span>
 <StatusBadge status={order.status} />
 <StatusBadge status={order.fulfillment} />
 </div>
 <span className="font-bold text-white">₹{parseFloat(order.total).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
 </div>

 {/* Line Items */}
 <div className="bg-white/5 p-3 mb-2">
 {order.items.map((item: any, i: number) => (
 <div key={i} className="flex items-center justify-between py-1 text-sm">
 <span className="text-white/80">{item.title} <span className="text-white/40">×{item.quantity}</span></span>
 <span className="text-white/60 font-medium">₹{parseFloat(item.price).toLocaleString('en-IN')}</span>
 </div>
 ))}
 </div>

 {/* Footer */}
 <div className="flex items-center justify-between text-xs text-white/40">
 <span>{formatDate(order.createdAt)}</span>
 {order.shippingAddress && (
 <span>{order.shippingAddress.city}, {order.shippingAddress.zip}</span>
 )}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </Modal>
 </div>
 );
}
