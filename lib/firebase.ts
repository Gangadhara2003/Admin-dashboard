import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    let serviceAccount;
    const envVar = process.env.FIREBASE_SERVICE_ACCOUNT
      ? process.env.FIREBASE_SERVICE_ACCOUNT.trim()
      : null;

    if (envVar) {
      try {
        if (envVar.startsWith('{') || envVar.charCodeAt(0) === 0xFEFF) {
          const cleanVar = envVar.charCodeAt(0) === 0xFEFF ? envVar.slice(1) : envVar;
          serviceAccount = JSON.parse(cleanVar);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          serviceAccount = require(envVar);
        }
      } catch (parseError: any) {
        console.error('[CRITICAL] Failed to parse FIREBASE_SERVICE_ACCOUNT:', parseError.message);
      }
    } else {
      console.warn('[WARN] FIREBASE_SERVICE_ACCOUNT not provided.');
    }

    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('[SUCCESS] Firebase Admin Initialized');
    }
  } catch (error) {
    console.error('[CRITICAL] Firebase Admin Initialization Error:', error);
  }
} else {
  console.log('[INFO] Firebase Admin already initialized');
}

export default admin;
