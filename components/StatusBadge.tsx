'use client';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { bg: string; text: string }> = {
  // Order statuses
  'new': { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  'pending': { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  'accepted': { bg: 'bg-indigo-500/20', text: 'text-indigo-400' },
  'packed': { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  'delivery_boy_coming': { bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
  'given_to_delivery': { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  'given to delivery': { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  'dispatched': { bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
  'in transit': { bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
  'in_transit': { bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
  'delivered': { bg: 'bg-green-500/20', text: 'text-green-400' },
  'completed': { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  'cancelled': { bg: 'bg-red-500/20', text: 'text-red-400' },
  'failed': { bg: 'bg-red-500/20', text: 'text-red-400' },
  'rejected': { bg: 'bg-red-500/20', text: 'text-red-400' },
  // Product / supplier statuses
  'active': { bg: 'bg-green-500/20', text: 'text-green-400' },
  'approved': { bg: 'bg-green-500/20', text: 'text-green-400' },
  'inactive': { bg: 'bg-white/10', text: 'text-white/50' },
  'in stock': { bg: 'bg-green-500/20', text: 'text-green-400' },
  'out of stock': { bg: 'bg-red-500/20', text: 'text-red-400' },
  'low stock': { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  // Payment statuses
  'paid': { bg: 'bg-green-500/20', text: 'text-green-400' },
  'unpaid': { bg: 'bg-red-500/20', text: 'text-red-400' },
  'processing': { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  // Ticket statuses
  'open': { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  'in progress': { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  'resolved': { bg: 'bg-green-500/20', text: 'text-green-400' },
  'escalated': { bg: 'bg-red-500/20', text: 'text-red-400' },
  'closed': { bg: 'bg-white/10', text: 'text-white/50' },
  // Shopify-specific
  'fulfilled': { bg: 'bg-green-500/20', text: 'text-green-400' },
  'unfulfilled': { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  'partially fulfilled': { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  'refunded': { bg: 'bg-purple-500/20', text: 'text-purple-400' },
};

const defaultStyle = { bg: 'bg-white/10', text: 'text-white/50' };

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const s = statusConfig[status.toLowerCase()] || defaultStyle;
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs';

  return (
    <span className={`inline-flex items-center font-bold uppercase tracking-tighter ${sizeClass} ${s.bg} ${s.text}`}>
      {(status.charAt(0).toUpperCase() + status.slice(1)).replace(/_/g, ' ')}
    </span>
  );
}
