'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

export default function AdminSupportPage() {
 const searchParams = useSearchParams();
 const [suppliers, setSuppliers] = useState<any[]>([]);
 const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
 const [messages, setMessages] = useState<any[]>([]);
 const [newMessage, setNewMessage] = useState('');
 const [loading, setLoading] = useState(true);
 const [sending, setSending] = useState(false);
 const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
 const messagesEndRef = useRef<HTMLDivElement>(null);
 const initialOpenDone = useRef(false);

 const fetchUnreadCounts = async () => {
 try {
 const res = await fetch('/api/chat?unreadCounts=true');
 const data = await res.json();
 setUnreadCounts(data.unread || {});
 } catch {}
 };

 useEffect(() => {
 async function fetchSuppliers() {
 try {
 const res = await fetch('/api/admin/suppliers');
 const data = await res.json();
 setSuppliers(data.suppliers || []);
 } catch (err) { console.error(err); }
 finally { setLoading(false); }
 }
 fetchSuppliers();
 fetchUnreadCounts();
 const interval = setInterval(fetchUnreadCounts, 10000);
 return () => clearInterval(interval);
 }, []);

 // Auto-open supplier from URL query param
 useEffect(() => {
 if (initialOpenDone.current || suppliers.length === 0) return;
 const paramId = searchParams.get('supplierId');
 if (paramId) {
 const match = suppliers.find(s => s._id === paramId);
 if (match) {
 setSelectedSupplier(match);
 initialOpenDone.current = true;
 }
 }
 }, [suppliers, searchParams]);

 const fetchMessages = async (supplierId: string) => {
 try {
 const res = await fetch(`/api/chat?supplierId=${supplierId}`);
 const data = await res.json();
 setMessages(data.messages || []);
 // Clear unread count for this supplier since admin just read them
 setUnreadCounts(prev => {
 const next = { ...prev };
 delete next[supplierId];
 return next;
 });
 } catch (err) { console.error(err); }
 };

 useEffect(() => {
 if (!selectedSupplier) return;
 fetchMessages(selectedSupplier._id);
 const interval = setInterval(() => fetchMessages(selectedSupplier._id), 8000);
 return () => clearInterval(interval);
 }, [selectedSupplier]);

 useEffect(() => {
 messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
 }, [messages]);

 const handleSend = async () => {
 if (!newMessage.trim() || !selectedSupplier || sending) return;
 setSending(true);
 try {
 const res = await fetch('/api/chat', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 supplierId: selectedSupplier._id,
 message: newMessage.trim(),
 }),
 });
 if (res.ok) {
 setNewMessage('');
 fetchMessages(selectedSupplier._id);
 }
 } catch { alert('Failed to send'); }
 finally { setSending(false); }
 };

 const handleKeyDown = (e: React.KeyboardEvent) => {
 if (e.key === 'Enter' && !e.shiftKey) {
 e.preventDefault();
 handleSend();
 }
 };

 const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

 return (
 <div className="flex flex-col h-[calc(100vh-7rem)]">
 <div className="mb-4">
 <h1 className="text-2xl font-bold text-white">Support Chat</h1>
 <p className="text-sm text-white/50 mt-1">Chat with your suppliers.</p>
 </div>

 <div className="flex flex-1 bg-white/5 border-2 border-white/10 overflow-hidden min-h-0">
 {/* Supplier List */}
 <div className="w-64 border-r border-white/10 flex flex-col shrink-0">
 <div className="p-3 border-b border-white/10 flex items-center justify-between">
 <h3 className="text-sm font-semibold text-white/60">Suppliers</h3>
 {totalUnread > 0 && (
 <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500/100 text-white rounded-full min-w-[18px] text-center">{totalUnread}</span>
 )}
 </div>
 <div className="flex-1 overflow-y-auto">
 {loading ? (
 <div className="p-4 text-sm text-white/40">Loading...</div>
 ) : suppliers.length === 0 ? (
 <div className="p-4 text-sm text-white/40">No suppliers found.</div>
 ) : (
 suppliers.map((s: any) => {
 const unread = unreadCounts[s._id] || 0;
 return (
 <button
 key={s._id}
 onClick={() => setSelectedSupplier(s)}
 className={`w-full text-left px-4 py-3 border-b border-white/5 transition-all bg-transparent text-sm cursor-pointer ${
 selectedSupplier?._id === s._id ? 'bg-accent/10 text-accent font-medium' : 'text-white/80 hover:bg-white/5'
 }`}
 >
 <div className="flex items-center justify-between">
 <div className="min-w-0 flex-1">
 <p className="font-medium truncate">{s.businessName || s.name}</p>
 <p className="text-xs text-white/40 truncate">{s.phone}</p>
 </div>
 {unread > 0 && (
 <span className="w-2.5 h-2.5 bg-red-500/100 rounded-full shrink-0 ml-2" />
 )}
 </div>
 </button>
 );
 })
 )}
 </div>
 </div>

 {/* Chat Area */}
 <div className="flex-1 flex flex-col min-w-0">
 {!selectedSupplier ? (
 <div className="flex-1 flex items-center justify-center">
 <div className="text-center">
 <svg className="w-16 h-16 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
 <p className="text-sm text-white/40">Select a supplier to start chatting</p>
 </div>
 </div>
 ) : (
 <>
 {/* Chat header */}
 <div className="px-4 py-3 border-b border-white/10 bg-white/5">
 <p className="text-sm font-semibold text-white">{selectedSupplier.businessName || selectedSupplier.name}</p>
 <p className="text-xs text-white/40">{selectedSupplier.phone}</p>
 </div>

 {/* Messages */}
 <div className="flex-1 overflow-y-auto p-4 space-y-3">
 {messages.length === 0 ? (
 <div className="flex items-center justify-center h-full"><p className="text-sm text-white/40">No messages yet.</p></div>
 ) : (
 messages.map((msg: any) => (
 <div key={msg._id} className={`flex ${msg.senderRole === 'admin' ? 'justify-end' : 'justify-start'}`}>
 <div className={`max-w-[75%] px-4 py-2.5 text-sm ${
 msg.senderRole === 'admin'
 ? 'bg-accent text-white rounded-br-md'
 : 'bg-white/10 text-white rounded-bl-md'
 }`}>
 <p className="whitespace-pre-wrap">{msg.message}</p>
 <p className={`text-[10px] mt-1 ${msg.senderRole === 'admin' ? 'text-blue-200' : 'text-white/40'}`}>
 {new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
 </p>
 </div>
 </div>
 ))
 )}
 <div ref={messagesEndRef} />
 </div>

 {/* Input */}
 <div className="border-t border-white/10 p-3 bg-white/5">
 <div className="flex gap-2">
 <textarea
 className="flex-1 px-4 py-2.5 bg-white/5 border-2 border-white/10 text-sm resize-none focus:outline-none focus:border-accent "
 rows={1}
 placeholder="Type a message..."
 value={newMessage}
 onChange={e => setNewMessage(e.target.value)}
 onKeyDown={handleKeyDown}
 />
 <button
 onClick={handleSend}
 disabled={!newMessage.trim() || sending}
 className="px-4 py-2.5 bg-accent text-white text-sm font-medium hover:bg-accent/80 disabled:opacity-50 transition-colors shrink-0"
 >
 {sending ? '...' : 'Send'}
 </button>
 </div>
 </div>
 </>
 )}
 </div>
 </div>
 </div>
 );
}
