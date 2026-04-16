import jwt, { SignOptions } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-development-only';

export function signToken(payload: object, expiresIn: string = '7d'): string {
  const options: SignOptions = { expiresIn: expiresIn as any };
  return jwt.sign(payload as string | Buffer | object, JWT_SECRET, options);
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export function getUserFromRequest(req: Request): any {
  try {
    let token: string | null = null;

    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      const cookieHeader = req.headers.get('cookie');
      if (cookieHeader) {
        const cookies = Object.fromEntries(
          cookieHeader.split('; ').map((c) => {
            const parts = c.split('=');
            return [parts[0], decodeURIComponent(parts.slice(1).join('='))];
          })
        );
        token = cookies['token'] || null;
      }
    }

    if (!token) return null;

    const verified = verifyToken(token);
    return verified;
  } catch (error) {
    console.error('Auth helper error:', error);
    return null;
  }
}
