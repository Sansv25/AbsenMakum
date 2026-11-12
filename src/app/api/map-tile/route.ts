import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latStr = searchParams.get('lat');
  const lngStr = searchParams.get('lng');

  if (!latStr || !lngStr) {
    return new NextResponse('Missing lat or lng', { status: 400 });
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (isNaN(lat) || isNaN(lng)) {
    return new NextResponse('Invalid lat or lng', { status: 400 });
  }

  const zoom = 16;
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );

  // 1. Coba OpenStreetMap tile
  try {
    const osmUrl = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
    const res = await fetch(osmUrl, {
      headers: {
        'User-Agent': 'AbsensiPiket-Iconnet/1.0 (contact: madesanjaya255@gmail.com)',
      },
    });

    if (res.ok) {
      const buffer = await res.arrayBuffer();
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
      });
    }
  } catch {
    // Fallback ke provider lain
  }

  // 2. Coba CartoDB Voyager tile
  try {
    const cartoUrl = `https://a.basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${x}/${y}.png`;
    const res = await fetch(cartoUrl);
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
      });
    }
  } catch {
    // Fallback jika tidak ada koneksi
  }

  // 3. Fallback SVG Map Tile
  const fallbackSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <rect width="256" height="256" fill="#e2e8f0"/>
      <path d="M0,64 L256,64 M0,128 L256,128 M0,192 L256,192 M64,0 L64,256 M128,0 L128,256 M192,0 L192,256" stroke="#cbd5e1" stroke-width="2"/>
      <circle cx="128" cy="128" r="6" fill="#ef4444"/>
    </svg>
  `.trim();

  return new NextResponse(fallbackSvg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

