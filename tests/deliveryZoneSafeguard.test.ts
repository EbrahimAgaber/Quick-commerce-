import { describe, it, expect } from 'vitest';
import {
  calculateHaversineDistanceKm,
  extractCoordinatesFromLocation,
  evaluateDeliveryZoneEligibility,
} from '../src/utils/cityUtils';

describe('Delivery Zone Safeguard & Distance Calculation', () => {
  it('correctly calculates Haversine distance between Riyadh and Al-Ula', () => {
    // Riyadh: 24.7136, 46.6753
    // Al-Ula: 26.6167, 37.9167
    const dist = calculateHaversineDistanceKm(24.7136, 46.6753, 26.6167, 37.9167);
    expect(dist).toBeGreaterThan(900);
    expect(dist).toBeLessThan(1000);
  });

  it('correctly extracts coordinates from Google Maps URLs and strings', () => {
    const url1 = 'https://www.google.com/maps?q=26.6167,37.9167';
    expect(extractCoordinatesFromLocation(url1)).toEqual({ lat: 26.6167, lng: 37.9167 });

    const url2 = 'https://maps.google.com/@24.7136,46.6753,15z';
    expect(extractCoordinatesFromLocation(url2)).toEqual({ lat: 24.7136, lng: 46.6753 });

    const rawCoords = '24.7136, 46.6753';
    expect(extractCoordinatesFromLocation(rawCoords)).toEqual({ lat: 24.7136, lng: 46.6753 });
  });

  it('allows order when deliveryZoneType is anywhere', () => {
    const res = evaluateDeliveryZoneEligibility({
      deliveryType: 'delivery',
      storeSettings: {
        city: 'العلا',
        deliveryZoneType: 'anywhere',
      },
      customer: {
        city: 'الرياض',
        address: 'حي الياسمين',
      },
    });
    expect(res.allowed).toBe(true);
  });

  it('blocks order when outside radius limit (e.g. 30km) with neat message', () => {
    const res = evaluateDeliveryZoneEligibility({
      deliveryType: 'delivery',
      storeSettings: {
        city: 'العلا',
        geoCoordinates: { lat: 26.6167, lng: 37.9167 },
        deliveryZoneType: 'radius',
        maxDeliveryRadiusKm: 30,
      },
      customer: {
        city: 'الرياض',
        coords: { lat: 24.7136, lng: 46.6753 },
      },
    });

    expect(res.allowed).toBe(false);
    expect(res.distanceKm).toBeGreaterThan(30);
    expect(res.message).toContain('خارج نطاق التوصيل المتاح');
    expect(res.message).toContain('الاستلام من الفرع');
  });

  it('allows order within the radius limit (e.g. 5km away)', () => {
    // Al Ula center: 26.6167, 37.9167
    // Nearby address: 26.6300, 37.9200 (~1.5 km)
    const res = evaluateDeliveryZoneEligibility({
      deliveryType: 'delivery',
      storeSettings: {
        city: 'العلا',
        geoCoordinates: { lat: 26.6167, lng: 37.9167 },
        deliveryZoneType: 'radius',
        maxDeliveryRadiusKm: 30,
      },
      customer: {
        city: 'العلا',
        coords: { lat: 26.6300, lng: 37.9200 },
      },
    });

    expect(res.allowed).toBe(true);
    expect(res.distanceKm).toBeLessThan(30);
  });

  it('always allows store pickup even if shopper is far away', () => {
    const res = evaluateDeliveryZoneEligibility({
      deliveryType: 'pickup',
      storeSettings: {
        city: 'العلا',
        deliveryZoneType: 'radius',
        maxDeliveryRadiusKm: 30,
      },
      customer: {
        city: 'الدمام',
      },
    });

    expect(res.allowed).toBe(true);
  });
});
