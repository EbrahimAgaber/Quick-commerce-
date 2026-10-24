import { handleCors, checkRateLimit, getClientIp } from '../_security';
import { getSaudiCityCoordinates } from '../../src/utils/cityUtils';

export interface ReverseGeocodeResult {
  success: boolean;
  city?: string;
  district?: string;
  street?: string;
  buildingNumber?: string;
  formattedAddress?: string;
  googleMapsUrl?: string;
  error?: string;
}

export default async function handler(req: any, res: any) {
  if (!handleCors(req, res)) {
    return res.status(403).json({ error: 'Origin not allowed.', success: false });
  }

  const clientIp = getClientIp(req);
  if (!checkRateLimit(`rev_geo_${clientIp}`, 60, 60 * 1000)) {
    return res.status(429).json({
      success: false,
      error: 'لقد تجاوزت معدل الاستعلام عن العناوين، يرجى الانتظار قليلاً.',
    });
  }

  const lat = parseFloat(req.query?.lat || req.body?.lat);
  const lng = parseFloat(req.query?.lng || req.body?.lng);

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({
      success: false,
      error: 'إحداثيات جغرافية غير صالحة.',
    });
  }

  const apiKey =
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    'AIzaSyBcmeQAMm_4cNErqam3lYDI5RhvPXlEqCc';

  const directMapsUrl = `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;

  try {
    if (apiKey) {
      const gmpUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=ar&region=sa&key=${apiKey}`;
      const response = await fetch(gmpUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'OK' && Array.isArray(data.results) && data.results.length > 0) {
          const topResult = data.results[0];
          let city = '';
          let district = '';
          let street = '';
          let buildingNumber = '';

          for (const component of topResult.address_components || []) {
            const types = component.types || [];
            if (types.includes('locality')) {
              city = component.long_name;
            } else if (!city && types.includes('administrative_area_level_2')) {
              city = component.long_name;
            }

            if (types.includes('sublocality') || types.includes('sublocality_level_1') || types.includes('neighborhood')) {
              district = component.long_name;
            }

            if (types.includes('route')) {
              street = component.long_name;
            }

            if (types.includes('street_number')) {
              buildingNumber = component.long_name;
            }
          }

          const formattedAddress = topResult.formatted_address || `${district}، ${city}`;

          return res.status(200).json({
            success: true,
            city,
            district,
            street,
            buildingNumber,
            formattedAddress,
            googleMapsUrl: directMapsUrl,
          });
        }
      }
    }
  } catch (err) {
    console.warn('Reverse geocode error via Google API, applying coordinate fallback:', err);
  }

  // Graceful fallback when network or API limits occur
  return res.status(200).json({
    success: true,
    city: 'المملكة العربية السعودية',
    district: '',
    street: '',
    buildingNumber: '',
    formattedAddress: `موقع محدد (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
    googleMapsUrl: directMapsUrl,
  });
}
