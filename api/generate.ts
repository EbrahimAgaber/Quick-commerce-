import { GoogleGenAI } from '@google/genai';

/**
 * Serverless API Function to securely proxy Gemini API requests.
 * Uses process.env.GEMINI_API_KEY strictly on the server-side,
 * completely preventing client-side API key exposure.
 */
export default async function handler(req: any, res: any) {
  // Set CORS headers for serverless endpoint
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
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

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: systemInstruction ? { systemInstruction } : undefined,
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
