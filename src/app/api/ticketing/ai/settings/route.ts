import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('ticketing_settings')
      .select('value')
      .eq('key', 'ai_auto_enabled')
      .maybeSingle();

    return NextResponse.json({
      enabled: typeof data?.value === 'boolean' ? data.value : true,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching AI settings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const enabled = Boolean(body.enabled);

    const supabase = await createClient();
    const { error } = await supabase
      .from('ticketing_settings')
      .upsert({
        key: 'ai_auto_enabled',
        value: enabled,
        updated_at: new Date().toISOString(),
      });

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, enabled });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error saving AI settings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
