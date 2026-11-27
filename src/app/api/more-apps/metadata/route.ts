import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/data/profile';
import {
  getDefaultFaviconUrl,
  isPrivateOrLocalHostname,
  normalizeAppUrl,
  normalizeIconUrl,
} from '@/lib/more-apps-utils';

function decodeBasicEntities(input: string): string {
  return input
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, ' ');
}

function getAttr(tag: string, attrName: string): string | null {
  const regex = new RegExp(`\\b${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = tag.match(regex);
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim() || null;
}

function pickBestIconHref(html: string, baseUrl: string): string | null {
  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
  const candidates: Array<{ href: string; score: number }> = [];

  for (const tag of linkTags) {
    const rel = (getAttr(tag, 'rel') ?? '').toLowerCase();
    const href = getAttr(tag, 'href');
    if (!href) continue;

    let score = 0;
    if (rel.includes('apple-touch-icon')) score = 100;
    else if (rel === 'icon' || rel.split(/\s+/).includes('icon')) score = 80;
    else if (rel.includes('shortcut icon')) score = 60;
    else continue;

    const sizes = getAttr(tag, 'sizes') ?? '';
    const sizeMatch = sizes.match(/(\d+)x(\d+)/i);
    if (sizeMatch) {
      const px = Number(sizeMatch[1]);
      if (px >= 64) score += 25;
      else if (px >= 32) score += 10;
    }

    if (/\.png(\?|$)/i.test(href) || /\.webp(\?|$)/i.test(href)) score += 10;
    if (/\.svg(\?|$)/i.test(href)) score += 5;

    try {
      const resolved = new URL(href, baseUrl).toString();
      const safe = normalizeIconUrl(resolved);
      if (safe) candidates.push({ href: safe, score });
    } catch {
      // Abaikan href ikon yang tidak valid
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.href ?? null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match?.[1]) return null;
  const cleaned = decodeBasicEntities(match[1].replace(/\s+/g, ' ').trim());
  if (!cleaned) return null;
  return cleaned.slice(0, 80);
}

export async function GET(request: NextRequest) {
  const { userId, canManageSettings } = await getCurrentUserProfile();
  if (!userId || !canManageSettings) {
    return NextResponse.json(
      { error: 'Hanya role Admin Piket ke atas yang dapat mengambil metadata shortcut.' },
      { status: 403 }
    );
  }

  const rawUrl = request.nextUrl.searchParams.get('url') ?? '';
  const normalized = normalizeAppUrl(rawUrl);
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const defaultIcon = getDefaultFaviconUrl(normalized.url);
  if (isPrivateOrLocalHostname(normalized.hostname)) {
    return NextResponse.json({
      url: normalized.url,
      hostname: normalized.hostname,
      iconUrl: defaultIcon,
      fallbackIconUrl: defaultIcon,
      title: null,
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(normalized.url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ICONNET-MoreAppBot/1.0)',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
    });

    const finalUrl = response.url || normalized.url;
    let finalHost = normalized.hostname;
    try {
      finalHost = new URL(finalUrl).hostname;
    } catch {
      // Gunakan hostname awal jika URL redirect gagal di-parse
    }

    if (isPrivateOrLocalHostname(finalHost)) {
      return NextResponse.json({
        url: normalized.url,
        hostname: normalized.hostname,
        iconUrl: defaultIcon,
        fallbackIconUrl: defaultIcon,
        title: null,
      });
    }

    const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
    const s2Fallback = getDefaultFaviconUrl(finalUrl) ?? defaultIcon;

    if (!response.ok || !contentType.includes('text/html')) {
      return NextResponse.json({
        url: normalized.url,
        hostname: normalized.hostname,
        iconUrl: s2Fallback,
        fallbackIconUrl: s2Fallback,
        title: null,
      });
    }

    const rawText = (await response.text()).slice(0, 180_000);
    const detectedIcon = pickBestIconHref(rawText, finalUrl);
    const title = extractTitle(rawText);

    return NextResponse.json({
      url: normalized.url,
      hostname: normalized.hostname,
      iconUrl: detectedIcon ?? s2Fallback,
      fallbackIconUrl: s2Fallback,
      title,
    });
  } catch {
    return NextResponse.json({
      url: normalized.url,
      hostname: normalized.hostname,
      iconUrl: defaultIcon,
      fallbackIconUrl: defaultIcon,
      title: null,
    });
  } finally {
    clearTimeout(timeout);
  }
}
