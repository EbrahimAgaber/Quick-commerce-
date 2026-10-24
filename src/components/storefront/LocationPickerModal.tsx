import React, { useState, useEffect } from 'react';
import { MapPin, X, Check, Navigation, ExternalLink, Compass, ShieldAlert, Sparkles } from 'lucide-react';
import { getSaudiCityCoordinates } from '../../utils/cityUtils';

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  city: string;
  initialAddress?: string;
  onConfirm: (locationData: {
    lat: number;
    lng: number;
    address: string;
    googleMapsUrl: string;
  }) => void;
  primaryColor?: string;
  accentColor?: string;
}

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  onClose,
  city,
  initialAddress = '',
  onConfirm,
  primaryColor = '#0F172A',
  accentColor = '#2563EB',
}) => {
  const defaultCoords = getSaudiCityCoordinates(city);
  const [lat, setLat] = useState<number>(defaultCoords.lat);
  const [lng, setLng] = useState<number>(defaultCoords.lng);
  const [streetDetails, setStreetDetails] = useState<string>(initialAddress);
  const [landmark, setLandmark] = useState<string>('');
  const [zoomLevel, setZoomLevel] = useState<number>(15);

  useEffect(() => {
    if (isOpen) {
      const coords = getSaudiCityCoordinates(city);
      setLat(coords.lat);
      setLng(coords.lng);
      setStreetDetails(initialAddress);
    }
  }, [isOpen, city, initialAddress]);

  if (!isOpen) return null;

  // Compute OpenStreetMap embed bounding box based on lat/lng and zoom
  const delta = 0.008;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const embedMapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat},${lng}`;
  const directMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  const handleNudgePin = (dLat: number, dLng: number) => {
    setLat((prev) => Number((prev + dLat).toFixed(6)));
    setLng((prev) => Number((prev + dLng).toFixed(6)));
  };

  const handleConfirm = () => {
    const finalAddress = streetDetails.trim()
      ? `${streetDetails.trim()}${landmark.trim() ? ` (علامة مميزة: ${landmark.trim()})` : ''}`
      : `موقع محدد بالخريطة في ${city} (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

    onConfirm({
      lat,
      lng,
      address: finalAddress,
      googleMapsUrl: directMapsUrl,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-stone-950/70 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 my-auto flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-stone-900">
                تحديد موقع المنزل بالدبوس على الخريطة
              </h3>
              <p className="text-[11px] text-stone-500">
                يعمل فوراً بدون الحاجة لمنح إذن الـ GPS في المتصفح ({city})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-stone-200 hover:bg-stone-100 flex items-center justify-center text-stone-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Map View Container */}
        <div className="p-4 space-y-3.5 flex-1 overflow-y-auto">
          {/* Map Preview Frame */}
          <div className="relative w-full h-56 sm:h-64 rounded-2xl overflow-hidden border border-stone-300 shadow-inner bg-stone-100">
            <iframe
              title="Interactive Pin Map"
              width="100%"
              height="100%"
              frameBorder="0"
              scrolling="no"
              marginHeight={0}
              marginWidth={0}
              src={embedMapUrl}
              className="w-full h-full pointer-events-none"
            />

            {/* Center Pin Indicator */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="flex flex-col items-center -translate-y-4 animate-bounce">
                <div className="px-2.5 py-1 rounded-full bg-stone-900 text-white text-[10px] font-bold shadow-lg flex items-center gap-1 mb-1">
                  <span>موقع بيتك هنا</span>
                </div>
                <MapPin className="w-8 h-8 text-rose-600 drop-shadow-md fill-rose-600" />
              </div>
            </div>

            {/* Quick Adjustment Controls */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-white/95 backdrop-blur-xs p-2 rounded-xl border border-stone-200 shadow-sm text-xs">
              <span className="font-mono text-[11px] text-stone-600 font-bold" dir="ltr">
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleNudgePin(0.001, 0)}
                  title="تحريك شمالاً"
                  className="w-7 h-7 bg-stone-100 hover:bg-stone-200 rounded-lg text-stone-700 font-bold flex items-center justify-center cursor-pointer"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => handleNudgePin(-0.001, 0)}
                  title="تحريك جنوباً"
                  className="w-7 h-7 bg-stone-100 hover:bg-stone-200 rounded-lg text-stone-700 font-bold flex items-center justify-center cursor-pointer"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => handleNudgePin(0, -0.001)}
                  title="تحريك غرباً"
                  className="w-7 h-7 bg-stone-100 hover:bg-stone-200 rounded-lg text-stone-700 font-bold flex items-center justify-center cursor-pointer"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => handleNudgePin(0, 0.001)}
                  title="تحريك شرقاً"
                  className="w-7 h-7 bg-stone-100 hover:bg-stone-200 rounded-lg text-stone-700 font-bold flex items-center justify-center cursor-pointer"
                >
                  →
                </button>
              </div>
            </div>
          </div>

          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-start gap-2 text-xs">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-blue-900 leading-relaxed text-[11px]">
              تم توجيه الخريطة تلقائياً لمركز مدينة <strong>{city}</strong>. استخدم الأسهم لضبط الدبوس على مبناك بدقة وسيتلقى المندوب مسار التوصيل المباشر.
            </p>
          </div>

          {/* Address Description Input */}
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                اسم الشارع / الحي / رقم البيت:
              </label>
              <input
                type="text"
                value={streetDetails}
                onChange={(e) => setStreetDetails(e.target.value)}
                placeholder="مثال: حي الصخيرات، شارع السلام، فيلا 14"
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                علامة مميزة قريبة (اختياري لتسهيل وصول المندوب):
              </label>
              <input
                type="text"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="مثال: بجوار مسجد النور أو مقابل سوبرماركت الواحة"
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-xl text-xs font-bold cursor-pointer"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            style={{ backgroundColor: accentColor }}
            className="flex-1 py-2.5 px-4 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm hover:opacity-90 cursor-pointer transition-all"
          >
            <Check className="w-4 h-4" />
            <span>تأكيد هذا الموقع وحفظ العنوان</span>
          </button>
        </div>
      </div>
    </div>
  );
};
