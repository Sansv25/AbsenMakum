import { NextRequest, NextResponse } from 'next/server';

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  street?: string;
  house_number?: string;
  village?: string;
  suburb?: string;
  neighbourhood?: string;
  hamlet?: string;
  town?: string;
  city_district?: string;
  county?: string;
  city?: string;
  municipality?: string;
  regency?: string;
  state?: string;
  country?: string;
  [key: string]: string | undefined;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latStr = searchParams.get('lat');
  const lngStr = searchParams.get('lng');

  if (!latStr || !lngStr) {
    return NextResponse.json({ error: 'Missing lat or lng parameter' }, { status: 400 });
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'Invalid lat or lng' }, { status: 400 });
  }

  try {
    // 1. Coba OpenStreetMap Nominatim terlebih dahulu
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=id`;
    const res = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'AbsensiPiket-Iconnet/1.0 (contact: madesanjaya255@gmail.com)',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const addr = (data.address || {}) as NominatimAddress;
      const lines = formatAddressLines(addr);

      if (lines.length > 0) {
        return NextResponse.json(
          {
            lines,
            formatted: lines.join(', '),
            source: 'nominatim',
          },
          {
            headers: {
              'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
            },
          }
        );
      }
    }
  } catch {
    // Fallback ke provider sekunder
  }

  // 2. Fallback: BigDataCloud Reverse Geocoding
  try {
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=id`;
    const res = await fetch(bdcUrl, { next: { revalidate: 3600 } });
    if (res.ok) {
      const data = await res.json();
      const lines: string[] = [];

      const street = data.localityInfo?.administrative?.[4]?.name || data.locality || '';
      const village = data.localityInfo?.administrative?.[3]?.name || '';
      const district = data.localityInfo?.administrative?.[2]?.name || '';
      const city = data.city || data.localityInfo?.administrative?.[1]?.name || '';
      const state = data.principalSubdivision || '';

      if (street) lines.push(street);
      if (village && village !== street) lines.push(village);
      if (district && district !== village) {
        lines.push(district.toLowerCase().startsWith('kecamatan') ? district : `Kecamatan ${district}`);
      }
      if (city) {
        lines.push(city.toLowerCase().startsWith('kota') || city.toLowerCase().startsWith('kabupaten') ? city : `Kota ${city}`);
      }
      if (state) lines.push(state);

      if (lines.length > 0) {
        return NextResponse.json(
          {
            lines,
            formatted: lines.join(', '),
            source: 'bigdatacloud',
          },
          {
            headers: {
              'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
            },
          }
        );
      }
    }
  } catch {
    // Fallback jika kedua layanan gagal
  }

  // 3. Fallback generic
  return NextResponse.json({
    lines: ['Denpasar', 'Bali', 'Indonesia'],
    formatted: 'Denpasar, Bali, Indonesia',
    source: 'fallback',
  });
}

function formatAddressLines(addr: NominatimAddress): string[] {
  const lines: string[] = [];

  // Baris 1: Nomor dan Jalan
  const road = addr.road || addr.pedestrian || addr.street || '';
  const houseNumber = addr.house_number || '';
  if (road) {
    lines.push(houseNumber ? `${houseNumber} ${road}` : road);
  } else if (addr.suburb) {
    lines.push(addr.suburb);
  }

  // Baris 2: Kelurahan / Desa
  const village = addr.village || addr.neighbourhood || addr.hamlet || '';
  if (village && !lines.includes(village)) {
    lines.push(village);
  }

  // Baris 3: Kecamatan
  const district = addr.town || addr.suburb || addr.city_district || addr.county || '';
  if (district && district !== village && !lines.includes(district)) {
    const formattedDistrict = district.toLowerCase().startsWith('kecamatan')
      ? district
      : `Kecamatan ${district}`;
    lines.push(formattedDistrict);
  }

  // Baris 4: Kota / Kabupaten
  const city = addr.city || addr.municipality || addr.regency || '';
  if (city && !lines.includes(city)) {
    const formattedCity =
      city.toLowerCase().startsWith('kota') || city.toLowerCase().startsWith('kabupaten')
        ? city
        : `Kota ${city}`;
    lines.push(formattedCity);
  }

  // Baris 5: Provinsi
  const state = addr.state || '';
  if (state && !lines.includes(state)) {
    lines.push(state);
  }

  return lines;
}

