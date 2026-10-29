import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../api/geo/reverseGeocode';

describe('Phase 6: Reverse Geocode Secrets and Graceful Degradation', () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
    delete process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.VITE_GOOGLE_MAPS_API_KEY;
  });

  afterEach(() => {
    process.env = origEnv;
    vi.restoreAllMocks();
  });

  it('degrades gracefully without hardcoded API key when env vars are missing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    let responseStatus: number = 0;
    let jsonResult: any = null;

    const req = {
      headers: { host: 'localhost:5173' },
      query: { lat: '24.7136', lng: '46.6753' },
    };
    const res = {
      setHeader: vi.fn(),
      status: vi.fn((code: number) => {
        responseStatus = code;
        return res;
      }),
      json: vi.fn((payload: any) => {
        jsonResult = payload;
        return res;
      }),
    };

    await handler(req, res);

    expect(responseStatus).toBe(200);
    expect(jsonResult).toBeDefined();
    expect(jsonResult.success).toBe(true);
    expect(jsonResult.formattedAddress).toContain('24.71360');
    // Crucial: fetch must NOT have been called with any hardcoded key!
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('uses GOOGLE_MAPS_API_KEY from environment if provided', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'TEST_ENV_KEY_12345';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'OK',
        results: [
          {
            formatted_address: 'حي الياسمين، الرياض',
            address_components: [
              { long_name: 'الرياض', types: ['locality'] },
              { long_name: 'حي الياسمين', types: ['sublocality'] },
              { long_name: 'شارع أنس بن مالك', types: ['route'] },
              { long_name: '123', types: ['street_number'] },
            ],
          },
        ],
      }),
    } as any);

    let responseStatus: number = 0;
    let jsonResult: any = null;

    const req = {
      headers: { host: 'localhost:5173' },
      query: { lat: '24.7136', lng: '46.6753' },
    };
    const res = {
      setHeader: vi.fn(),
      status: vi.fn((code: number) => {
        responseStatus = code;
        return res;
      }),
      json: vi.fn((payload: any) => {
        jsonResult = payload;
        return res;
      }),
    };

    await handler(req, res);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('key=TEST_ENV_KEY_12345')
    );
    expect(responseStatus).toBe(200);
    expect(jsonResult.city).toBe('الرياض');
    expect(jsonResult.district).toBe('حي الياسمين');
    expect(jsonResult.street).toBe('شارع أنس بن مالك');
    expect(jsonResult.buildingNumber).toBe('123');
  });
});
