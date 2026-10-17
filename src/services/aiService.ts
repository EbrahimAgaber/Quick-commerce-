import { getFirebaseIdToken } from './firebase';

/**
 * Client-Side AI Service that connects exclusively to the secure serverless proxy (/api/generate).
 * Never injects or requires GEMINI_API_KEY into client-side environment variables.
 */

export interface AIGenerationResponse {
  success: boolean;
  text?: string;
  error?: string;
}

export async function requestAIGeneration(
  prompt: string,
  systemInstruction?: string
): Promise<AIGenerationResponse> {
  try {
    const idToken = await getFirebaseIdToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt, systemInstruction }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `Server responded with status ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      text: data.text,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to communicate with AI server proxy',
    };
  }
}
