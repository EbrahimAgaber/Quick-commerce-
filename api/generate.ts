import { GoogleGenAI } from '@google/genai';
import { getAdminAuth } from './_firebaseAdmin';
import { handleCors, checkRateLimit, getClientIp, AI_TEMPLATES } from './_security';

const MAX_PROMPT_LENGTH = 1500;
const MERCHANT_RATE_LIMIT_MAX = 15;
const MERCHANT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Hardened Serverless API Function to proxy Gemini AI requests.
 * Enforces Firebase ID token verification, rate limits, server-controlled prompts,
 * and strict CORS allow-lists.
 */
export default async function handler(req: any, res: any) {
  if (!handleCors(req, res)) {
    return res.status(403).json({ error: 'Origin not allowed.', success: false });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.', success: false });
  }

  // 1. Verify Firebase ID Token via Admin SDK
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required. Please sign in as a merchant.',
      success: false,
    });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  let decodedToken;
  try {
    const adminAuth = getAdminAuth();
    decodedToken = await adminAuth.verifyIdToken(token, true);
  } catch (authErr: any) {
    console.error('Firebase token verification failed:', authErr.code || authErr.message);
    return res.status(401).json({
      error: 'Invalid, expired, or revoked merchant authentication token.',
      success: false,
    });
  }

  const merchantUid = decodedToken.uid;

  // 2. Enforce per-merchant rate limit
  const rateLimitAllowed = checkRateLimit(
    `ai_${merchantUid}`,
    MERCHANT_RATE_LIMIT_MAX,
    MERCHANT_RATE_LIMIT_WINDOW_MS
  );

  if (!rateLimitAllowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Please wait a few minutes before generating more content.',
      success: false,
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not configured on the server.');
    return res.status(500).json({
      error: 'AI copywriting service is currently unavailable.',
      success: false,
    });
  }

  try {
    const { prompt, templateKey = 'product_description' } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Valid prompt string is required.', success: false });
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return res.status(400).json({
        error: `Prompt exceeds maximum allowed length of ${MAX_PROMPT_LENGTH} characters.`,
        success: false,
      });
    }

    // Stop accepting client-supplied systemInstruction. Use fixed server-side templates only.
    const systemInstruction = AI_TEMPLATES[templateKey] || AI_TEMPLATES.product_description;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    return res.status(200).json({
      success: true,
      text: response.text,
    });
  } catch (err: any) {
    // Log sensitive details server-side only; return safe generic error to client
    console.error('Server Gemini API Error:', err);
    return res.status(500).json({
      error: 'An unexpected error occurred while generating content. Please try again.',
      success: false,
    });
  }
}
