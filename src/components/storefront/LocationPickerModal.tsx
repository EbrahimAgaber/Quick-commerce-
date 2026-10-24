import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  APIProvider,
  Map,
  useMap,
  useMapsLibrary,
  MapCameraChangedEvent,
  MapMouseEvent,
} from '@vis.gl/react-google-maps';
import {
  MapPin,
  X,
  Check,
  Navigation,
  Search,
  Crosshair,
  Layers,
  Plus,
  Minus,
  Sparkles,
  Building,
  Flag,
  Loader2,
  AlertCircle,
  Compass,
} from 'lucide-react';
import { getSaudiCityCoordinates } from '../../utils/cityUtils';

const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  'AIzaSyBcmeQAMm_4cNErqam3lYDI5RhvPXlEqCc';

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

// Popular Saudi Neighborhoods for Quick Jump
const CITY_DISTRICT_PRESETS: Record<string, string[]> = {
  'الرياض': ['حي النرجس', 'حي الياسمين', 'حي الملقا', 'حي حطين', 'حي العليا', 'حي الرمال'],
  'جدة': ['حي الروضة', 'حي الشاطئ', 'حي الزهراء', 'حي الحمراء', 'حي المرجان', 'حي أبحر'],
  'مكة المكرمة': ['حي العزيزية', 'حي الشوقية', 'حي العوالي', 'حي بطحاء قريش'],
  'المدينة المنورة': ['حي قباء', 'حي الهجرة', 'حي باقدو', 'حي مذينب'],
  'الدمام': ['حي الشاطئ', 'حي الفيصلية', 'حي المزروعية', 'حي الفاخرية'],
  'الخبر': ['حي العليا', 'حي الحزام الذهبي', 'حي العقربية', 'حي الكورنيش'],
  'الظهران': ['حي الدوحة', 'حي القصور', 'حي الجامعة'],
  'أبها': ['حي المنسك', 'حي الموظفين', 'حي السد'],
  'تبوك': ['حي المروج', 'حي الورود', 'حي السليمانية'],
  'العلا': ['حي الصخيرات', 'حي العزيزية', 'حي المحطة'],
};

interface MapContentProps {
  city: string;
  lat: number;
  lng: number;
  setLat: (val: number) => void;
  setLng: (val: number) => void;
  detectedAddress: string;
  setDetectedAddress: (val: string) => void;
  onReverseGeocode: (lat: number, lng: number) => Promise<void>;
  accentColor: string;
}

const MapContent: React.FC<MapContentProps> = ({
  city,
  lat,
  lng,
  setLat,
  setLng,
  detectedAddress,
  setDetectedAddress,
  onReverseGeocode,
  accentColor,
}) => {
  const map = useMap();
  const placesLib = useMapsLibrary('places');

  const [isMapMoving, setIsMapMoving] = useState(false);
  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'hybrid'>('roadmap');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsError, setGpsError] = useState('');

  // Places Autocomplete Session Token Ref
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize or reset session token
  const resetSession = useCallback(() => {
    if (placesLib) {
      sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
    }
  }, [placesLib]);

  useEffect(() => {
    resetSession();
  }, [resetSession]);

  // Autocomplete fetch logic using modern AutocompleteSuggestion API
  useEffect(() => {
    if (!placesLib || !searchQuery.trim()) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        if (!sessionTokenRef.current) {
          resetSession();
        }

        setIsSearching(true);
        const { AutocompleteSuggestion } = placesLib;
        const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: searchQuery,
          sessionToken: sessionTokenRef.current || undefined,
          includedRegionCodes: ['sa'],
          language: 'ar',
        });

        setSuggestions(response.suggestions || []);
      } catch (err) {
        console.warn('Error fetching place suggestions:', err);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery, placesLib, resetSession]);

  // Handle selecting a place suggestion
  const handleSelectSuggestion = async (suggestion: google.maps.places.AutocompleteSuggestion) => {
    if (!suggestion.placePrediction) return;

    try {
      setIsSearching(true);
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['location', 'displayName', 'formattedAddress'],
      });

      if (place.location && map) {
        const newLat = place.location.lat();
        const newLng = place.location.lng();
        setLat(newLat);
        setLng(newLng);

        map.panTo({ lat: newLat, lng: newLng });
        map.setZoom(17);

        if (place.formattedAddress) {
          setDetectedAddress(place.formattedAddress);
        } else if (place.displayName) {
          setDetectedAddress(place.displayName);
        }

        setSearchQuery('');
        setSuggestions([]);
        resetSession();
      }
    } catch (err) {
      console.warn('Failed to retrieve place details:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle Map Camera Movement
  const handleCameraChanged = (ev: MapCameraChangedEvent) => {
    setIsMapMoving(true);
    const center = ev.detail.center;
    if (center && typeof center.lat === 'number' && typeof center.lng === 'number') {
      setLat(center.lat);
      setLng(center.lng);
    }

    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    // Debounce reverse geocoding when camera settles
    idleTimerRef.current = setTimeout(() => {
      setIsMapMoving(false);
      if (center) {
        onReverseGeocode(center.lat, center.lng);
      }
    }, 450);
  };

  // Handle Clicking on Map to Move Pin
  const handleMapClick = (ev: MapMouseEvent) => {
    if (ev.detail.latLng && map) {
      const clickedLat = ev.detail.latLng.lat;
      const clickedLng = ev.detail.latLng.lng;
      setLat(clickedLat);
      setLng(clickedLng);
      map.panTo({ lat: clickedLat, lng: clickedLng });
      onReverseGeocode(clickedLat, clickedLng);
    }
  };

  // High-Accuracy GPS Locate Button
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setGpsError('خاصية تحديد الموقع غير مدعومة في متصفحك.');
      return;
    }

    setIsLocating(true);
    setGpsError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        setLat(userLat);
        setLng(userLng);
        if (map) {
          map.panTo({ lat: userLat, lng: userLng });
          map.setZoom(17);
        }
        onReverseGeocode(userLat, userLng);
        setIsLocating(false);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setGpsError('تعذر تحديد موقعك الحالي بدقة. يرجى تفعيل إذن الموقع أو استخدام البحث بالحي.');
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // Quick District preset click
  const handlePresetDistrictClick = async (districtName: string) => {
    const fullQuery = `${districtName} ${city} السعودية`;
    setSearchQuery(districtName);

    if (placesLib) {
      try {
        setIsSearching(true);
        const { AutocompleteSuggestion } = placesLib;
        const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: fullQuery,
          includedRegionCodes: ['sa'],
          language: 'ar',
        });
        if (res.suggestions && res.suggestions.length > 0) {
          await handleSelectSuggestion(res.suggestions[0]);
        }
      } catch (err) {
        console.warn('Preset district lookup error:', err);
      } finally {
        setIsSearching(false);
      }
    }
  };

  return (
    <div className="relative w-full h-[320px] sm:h-[400px] rounded-2xl overflow-hidden border border-stone-200 shadow-inner bg-stone-100">
      {/* Floating Search Bar */}
      <div className="absolute top-3 left-3 right-3 z-20">
        <div className="relative flex items-center bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-stone-200/80 px-3 py-2 transition-all focus-within:ring-2 focus-within:ring-blue-500/30">
          <Search className="w-4 h-4 text-stone-400 shrink-0 ml-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`ابحث عن اسم الحي، الشارع، أو المعلم في ${city}...`}
            className="w-full bg-transparent text-xs text-stone-800 placeholder-stone-400 focus:outline-none"
          />
          {isSearching && <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0 mr-1" />}
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSuggestions([]);
              }}
              className="text-stone-400 hover:text-stone-600 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Autocomplete Suggestions Dropdown */}
        {suggestions.length > 0 && (
          <div className="mt-1 bg-white rounded-2xl shadow-xl border border-stone-200 max-h-52 overflow-y-auto divide-y divide-stone-100 text-xs z-30">
            {suggestions.map((sug, idx) => {
              const primary = sug.placePrediction?.mainText?.toString() || '';
              const secondary = sug.placePrediction?.secondaryText?.toString() || '';
              return (
                <button
                  key={sug.placePrediction?.placeId || idx}
                  type="button"
                  onClick={() => handleSelectSuggestion(sug)}
                  className="w-full text-right p-3 hover:bg-blue-50/60 flex items-start gap-2.5 transition-colors cursor-pointer"
                >
                  <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-stone-900 text-xs">{primary}</p>
                    {secondary && <p className="text-[11px] text-stone-500 mt-0.5">{secondary}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Map Controls (Locate Me + Layer Switcher + Zoom) */}
      <div className="absolute left-3 bottom-4 z-20 flex flex-col gap-2">
        {/* GPS Locate Me Button */}
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={isLocating}
          title="تحديد موقعي الحالي بدقة"
          className="w-10 h-10 bg-white hover:bg-stone-50 active:bg-stone-100 rounded-2xl shadow-lg border border-stone-200/80 flex items-center justify-center text-stone-700 hover:text-blue-600 transition-all cursor-pointer"
        >
          {isLocating ? (
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          ) : (
            <Crosshair className="w-5 h-5 text-blue-600" />
          )}
        </button>

        {/* Map Type Switcher (Roadmap vs Satellite) */}
        <button
          type="button"
          onClick={() => setMapTypeId((prev) => (prev === 'roadmap' ? 'hybrid' : 'roadmap'))}
          title={mapTypeId === 'roadmap' ? 'التحويل للأقمار الصناعية' : 'التحويل للخريطة التخطيطية'}
          className="w-10 h-10 bg-white hover:bg-stone-50 rounded-2xl shadow-lg border border-stone-200/80 flex items-center justify-center text-stone-700 transition-all cursor-pointer"
        >
          <Layers className="w-5 h-5" />
        </button>

        {/* Zoom Controls */}
        <div className="flex flex-col bg-white rounded-2xl shadow-lg border border-stone-200/80 overflow-hidden">
          <button
            type="button"
            onClick={() => map && map.setZoom((map.getZoom() || 16) + 1)}
            title="تكبير الخريطة"
            className="w-10 h-9 flex items-center justify-center text-stone-700 hover:bg-stone-50 border-b border-stone-100 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => map && map.setZoom((map.getZoom() || 16) - 1)}
            title="تصغير الخريطة"
            className="w-10 h-9 flex items-center justify-center text-stone-700 hover:bg-stone-50 cursor-pointer"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* GPS Error Toast */}
      {gpsError && (
        <div className="absolute top-16 left-3 right-3 z-20 bg-rose-50 border border-rose-200 text-rose-800 text-[11px] p-2.5 rounded-xl shadow-md flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{gpsError}</span>
          </div>
          <button
            type="button"
            onClick={() => setGpsError('')}
            className="text-rose-500 hover:text-rose-700 font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Quick District Presets Strip */}
      {CITY_DISTRICT_PRESETS[city] && CITY_DISTRICT_PRESETS[city].length > 0 && (
        <div className="absolute top-14 right-3 z-10 flex items-center gap-1.5 overflow-x-auto max-w-[calc(100%-24px)] py-1 scrollbar-none">
          {CITY_DISTRICT_PRESETS[city].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handlePresetDistrictClick(d)}
              className="shrink-0 px-2.5 py-1 bg-white/90 hover:bg-white backdrop-blur-xs text-stone-800 hover:text-blue-700 rounded-full text-[10px] font-bold shadow-sm border border-stone-200/80 transition-all cursor-pointer"
            >
              {d}
            </button>
          ))}
        </div>
      )}

      {/* Interactive Google Map Instance */}
      <Map
        mapId="DEMO_MAP_ID"
        defaultCenter={{ lat, lng }}
        defaultZoom={16}
        mapTypeId={mapTypeId}
        gestureHandling="greedy"
        disableDefaultUI={true}
        onCameraChanged={handleCameraChanged}
        onClick={handleMapClick}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        className="w-full h-full"
      />

      {/* Fixed Center Interactive Pin UX (Gold Standard Delivery UX) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <div className="flex flex-col items-center">
          {/* Floating Pill Label */}
          <div
            className={`px-3 py-1 rounded-full bg-stone-900 text-white text-[11px] font-bold shadow-xl flex items-center gap-1.5 transition-all duration-200 mb-1 ${
              isMapMoving
                ? 'opacity-80 scale-95 -translate-y-6'
                : 'opacity-100 scale-100 -translate-y-4'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>حرّك الخريطة لتثبيت موقع باب بيتك</span>
          </div>

          {/* Animated Delivery Pin */}
          <div
            className={`relative transition-transform duration-200 ease-out ${
              isMapMoving ? '-translate-y-7 scale-110' : '-translate-y-3 scale-100'
            }`}
          >
            <MapPin className="w-10 h-10 text-rose-600 fill-rose-600 drop-shadow-2xl" />
            {/* Center crosshair dot */}
            <div className="absolute top-[13px] left-[15px] w-2.5 h-2.5 bg-white rounded-full shadow-inner" />
          </div>

          {/* Dynamic Pin Shadow */}
          <div
            className={`w-4 h-1.5 bg-stone-900/30 rounded-full blur-[2px] transition-all duration-200 ${
              isMapMoving ? 'scale-75 opacity-20' : 'scale-100 opacity-60'
            }`}
          />
        </div>
      </div>

      {/* Live Coordinate Badge (Bottom Right) */}
      <div className="absolute bottom-3 right-3 z-10 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-xl border border-stone-200/80 shadow-sm text-[10px] font-mono text-stone-600 font-semibold" dir="ltr">
        {lat.toFixed(5)}, {lng.toFixed(5)}
      </div>
    </div>
  );
};

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
  const [detectedAddress, setDetectedAddress] = useState<string>(initialAddress);
  const [buildingNumber, setBuildingNumber] = useState<string>('');
  const [landmark, setLandmark] = useState<string>('');
  const [isReverseGeocoding, setIsReverseGeocoding] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const coords = getSaudiCityCoordinates(city);
      setLat(coords.lat);
      setLng(coords.lng);
      setDetectedAddress(initialAddress || `${city}، المملكة العربية السعودية`);
      handleReverseGeocode(coords.lat, coords.lng);
    }
  }, [isOpen, city, initialAddress]);

  // Reverse Geocoding Handler via Serverless Proxy
  const handleReverseGeocode = async (targetLat: number, targetLng: number) => {
    try {
      setIsReverseGeocoding(true);
      const res = await fetch(`/api/geo/reverseGeocode?lat=${targetLat}&lng=${targetLng}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.formattedAddress) {
          setDetectedAddress(data.formattedAddress);
          if (data.buildingNumber && !buildingNumber) {
            setBuildingNumber(data.buildingNumber);
          }
        }
      }
    } catch (err) {
      console.warn('Reverse geocode lookup error:', err);
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  if (!isOpen) return null;

  const directMapsUrl = `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;

  const handleConfirm = () => {
    let finalAddress = detectedAddress.trim();
    if (buildingNumber.trim()) {
      finalAddress += ` - مبنى/فيلا ${buildingNumber.trim()}`;
    }
    if (landmark.trim()) {
      finalAddress += ` (علامة مميزة: ${landmark.trim()})`;
    }

    if (!finalAddress) {
      finalAddress = `موقع محدد بالخريطة في ${city} (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    }

    onConfirm({
      lat,
      lng,
      address: finalAddress,
      googleMapsUrl: directMapsUrl,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto bg-stone-950/75 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-stone-200 my-auto flex flex-col max-h-[94vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 shadow-xs">
              <Compass className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-stone-900">
                تحديد موقع التوصيل بدقة على الخريطة
              </h3>
              <p className="text-[11px] text-stone-500 mt-0.5">
                حرّك الخريطة أو ابحث عن حيك لتثبيت موقع باب بيتك ({city})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-stone-200 hover:bg-stone-100 flex items-center justify-center text-stone-500 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Map & Address Picking Body */}
        <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto">
          {/* Interactive Google Map with Places API Autocomplete */}
          <APIProvider apiKey={GOOGLE_MAPS_API_KEY} language="ar" region="SA">
            <MapContent
              city={city}
              lat={lat}
              lng={lng}
              setLat={setLat}
              setLng={setLng}
              detectedAddress={detectedAddress}
              setDetectedAddress={setDetectedAddress}
              onReverseGeocode={handleReverseGeocode}
              accentColor={accentColor}
            />
          </APIProvider>

          {/* Real-time Address Card */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-600" />
                <span>العنوان المحدد حالياً:</span>
              </span>
              {isReverseGeocoding ? (
                <span className="text-[10px] text-blue-700 flex items-center gap-1 font-medium">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>جاري قراءة الحي والشارع...</span>
                </span>
              ) : (
                <span className="text-[10px] text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>دقيق</span>
                </span>
              )}
            </div>
            <p className="text-xs font-bold text-stone-900 leading-relaxed bg-white/90 p-2.5 rounded-xl border border-blue-100">
              {detectedAddress || 'جارِ تحديد العنوان...'}
            </p>
          </div>

          {/* Building Number and Landmark Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-stone-500" />
                <span>رقم المبنى / الفيلا / الشقة:</span>
              </label>
              <input
                type="text"
                value={buildingNumber}
                onChange={(e) => setBuildingNumber(e.target.value)}
                placeholder="مثال: فيلا 14، الدور الثاني"
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1 flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5 text-stone-500" />
                <span>علامة مميزة قريبة (اختياري):</span>
              </label>
              <input
                type="text"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="مثال: بجوار مسجد النور، مقابل سوبرماركت"
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer CTA */}
        <div className="p-4 sm:p-5 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            style={{ backgroundColor: accentColor }}
            className="flex-1 py-3 px-5 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:brightness-105 active:scale-[0.99] cursor-pointer transition-all"
          >
            <Check className="w-4 h-4" />
            <span>تأكيد هذا الموقع وحفظ العنوان</span>
          </button>
        </div>
      </div>
    </div>
  );
};
