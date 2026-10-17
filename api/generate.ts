import { GoogleGenAI } from '@google/genai';

const MAX_PROMPT_LENGTH = 2000;
const MAX_SYSTEM_INSTRUCTION_LENGTH = 1000;

/**
 * Serverless API Function to securely proxy Gemini API requests.
 * Uses process.env.GEMINI_API_KEY strictly on the server-side,
 * completely preventing client-side API key exposure.
 */
export default async function handler(req: any, res: any) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  // Require an authenticated merchant session token to prevent anonymous quota abuse
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required. Please sign in as a merchant to use AI generation.',
      success: false,
    });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (token.split('.').length !== 3) {
    return res.status(401).json({
      error: 'Invalid authentication token format.',
      success: false,
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY is not configured in server environment variables.',
      success: false,
    });
  }

  try {
    const { prompt, systemInstruction } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Valid prompt string is required.', success: false });
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return res.status(400).json({
        error: `Prompt exceeds maximum allowed length (${MAX_PROMPT_LENGTH} characters).`,
        success: false,
      });
    }

    const safeSystemInstruction =
      typeof systemInstruction === 'string'
        ? systemInstruction.slice(0, MAX_SYSTEM_INSTRUCTION_LENGTH)
        : undefined;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: safeSystemInstruction ? { systemInstruction: safeSystemInstruction } : undefined,
    });

    return res.status(200).json({
      success: true,
      text: response.text,
    });
  } catch (err: any) {
    console.error('Server Gemini API Error:', err);
    return res.status(500).json({
      error: err.message || 'Error processing request with Gemini API',
      success: false,
    });
  }
}
