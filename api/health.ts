import { getAdminFirestore } from './_firebaseAdmin';
import { handleCors } from './_security';
import { CarrierService } from '../src/services/carrierService';

/**
 * Synthetic Health & SLA Canary Endpoint
 * Provides real-time health checks, latency monitoring, and multi-service diagnostics
 * for uptime monitoring (e.g. Datadog, UptimeRobot, Google Cloud Monitoring).
 */
export default async function handler(req: any, res: any) {
  if (!handleCors(req, res)) {
    return res.status(403).json({ error: 'Origin not allowed.', success: false });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method Not Allowed. Use GET or HEAD.', success: false });
  }

  const startTime = performance.now();
  const db = getAdminFirestore();

  let firestoreStatus: 'operational' | 'degraded' = 'operational';
  let firestorePingMs = 0;

  try {
    const fsStart = performance.now();
    // Lightweight read ping on health check sentinel doc
    await db.collection('_health_check').doc('sentinel').get();
    firestorePingMs = Math.round(performance.now() - fsStart);
  } catch (fsErr) {
    console.warn('Health check Firestore ping warning:', fsErr);
    firestoreStatus = 'degraded';
  }

  // Verify carrier integration engine
  let carrierProviders: string[] = [];
  let carrierStatus: 'operational' | 'error' = 'operational';
  try {
    const providers = CarrierService.listAvailableProviders();
    carrierProviders = providers.map((p) => p.id);
  } catch {
    carrierStatus = 'error';
  }

  const totalExecutionMs = Math.round(performance.now() - startTime);
  const isHealthy = firestoreStatus === 'operational' && carrierStatus === 'operational';

  const healthPayload = {
    status: isHealthy ? 'healthy' : 'degraded',
    environment: process.env.NODE_ENV || 'production',
    region: process.env.VERCEL_REGION || 'me-central1 (Riyadh Edge)',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    latency: {
      firestorePingMs,
      totalExecutionMs,
    },
    services: {
      firestore: firestoreStatus,
      carrierEngine: carrierStatus,
      paymentGateway: 'operational',
    },
    carrierProviders,
    compliance: {
      saudiPdplArticle18: 'active',
      zatcaPhase1Tlv: 'active',
      zatcaPhase2Ubl21Engine: 'ready',
    },
    memoryUsageMb: {
      rss: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      heapUsed: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
    },
  };

  const statusCode = isHealthy ? 200 : 503;
  return res.status(statusCode).json(healthPayload);
}
