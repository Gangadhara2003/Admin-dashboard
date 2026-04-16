import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ message: 'Logged out' });
  response.cookies.set({ name: 'token', value: '', httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return response;
}
