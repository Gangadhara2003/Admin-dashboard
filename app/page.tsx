'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      router.push('/admin');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-dark relative">
      {/* Noise overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0" style={{ backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')" }} />

      <div className="w-full max-w-md brutalist-border bg-white/5 p-8 relative z-10">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold tracking-tighter text-center">
            <span className="text-accent">NX</span> OS
          </h1>
          <p className="text-center text-[10px] text-white/40 mt-2 uppercase tracking-[0.3em] font-display">Admin Command Center</p>
        </div>

        {error && (
          <div className="p-3 mb-4 text-sm bg-red-500/10 border border-red-500/30 text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="mb-5">
            <label className="block mb-2 text-white/50 text-[10px] font-display uppercase tracking-widest font-bold">Phone Number</label>
            <input
              type="tel"
              className="w-full px-4 py-3 bg-white/5 border-2 border-white/10 text-white text-sm transition-all focus:outline-none focus:border-accent placeholder-white/20"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter admin phone number"
              required
            />
          </div>

          <div className="mb-5">
            <label className="block mb-2 text-white/50 text-[10px] font-display uppercase tracking-widest font-bold">Password</label>
            <input
              type="password"
              className="w-full px-4 py-3 bg-white/5 border-2 border-white/10 text-white text-sm transition-all focus:outline-none focus:border-accent placeholder-white/20"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full mt-4 px-6 py-3 bg-accent text-black font-display text-xs font-bold tracking-widest uppercase brutalist-shadow-accent hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? 'Accessing...' : 'Enter Command'}
          </button>
        </form>
      </div>
    </div>
  );
}
