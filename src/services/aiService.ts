import { getFirebaseIdToken } from './firebase';

/**
 * Client-Side AI Service that connects to the hardened serverless proxy (/api/generate).
 * Never returns false success when the server API fails.
 */

export interface AIGenerationResponse {
  success: boolean;
  text?: string;
  error?: string;
  isTemplate?: boolean;
}

export async function requestAIGeneration(
  prompt: string,
  templateKey: 'product_description' | 'tagline' | 'store_hero' = 'product_description'
): Promise<AIGenerationResponse> {
  const idToken = await getFirebaseIdToken();
  if (!idToken) {
    return {
      success: false,
      error: 'يرجى تسجيل الدخول كتاجر لاستخدام مساعد الذكاء الاصطناعي.',
    };
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    };

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt, templateKey }),
    });

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      if (response.ok && data?.text) {
        return {
          success: true,
          text: data.text,
        };
      }
      return {
        success: false,
        error: data?.error || 'تعذر توليد النص بواسطة الذكاء الاصطناعي.',
      };
    }

    return {
      success: false,
      error: `خطأ في خادم الذكاء الاصطناعي (${response.status}).`,
    };
  } catch (err: any) {
    console.error('AI Generation Request Failed:', err);
    return {
      success: false,
      error: 'تعذر الاتصال بخادم الذكاء الاصطناعي. يرجى التحقق من اتصالك بالإنترنت.',
    };
  }
}

/**
 * Explicit template generator when merchant chooses to use standard copywriting templates offline
 */
export function getArabicCopyTemplate(
  prompt: string,
  type: 'product' | 'tagline' = 'product'
): string {
  const clean = prompt.trim();
  if (type === 'product') {
    const nameMatch = clean.match(/(?:منتج|المنتج):\s*([^\n،,]+)/);
    const catMatch = clean.match(/(?:التصنيف|الفئة):\s*([^\n،,]+)/);
    const productName = nameMatch ? nameMatch[1].trim() : 'هذا المنتج المميز';
    const category = catMatch ? catMatch[1].trim() : 'تشكيلتنا المختارة';

    return `[قالب جاهز] استمتع بأعلى معايير الجودة والأناقة مع «${productName}» من قسم ${category}. صُمّم بعناية فائقة ليجمع بين المظهر العصري الفاخر والاعتمادية اليومية، مع خامات منتقاة تمنحك تجربة استثنائية تدوم طويلاً. متوفر الآن مع شحن سريع وتغليف فاخر.`;
  }

  return `[قالب جاهز] وجهتك الأولى للتسوق العصري السريع — منتجات أصلية مختارة بعناية، أسعار تنافسية، وطلب مباشر عبر الواتساب بخدمة توصيل سريعة وموثوقة.`;
}
