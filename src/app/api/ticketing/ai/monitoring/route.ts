import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/data/profile';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('ticketing_settings')
      .select('value')
      .eq('key', 'ai_monitoring_enabled')
      .maybeSingle();

    return NextResponse.json({
      enabled: typeof data?.value === 'boolean' ? data.value : false,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching monitoring settings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { isOwner } = await getCurrentUserProfile();
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Hanya akun dengan role Owner yang berhak mengubah mode monitoring tiket.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const enabled = Boolean(body.enabled);

    const supabase = await createClient();
    const { error } = await supabase
      .from('ticketing_settings')
      .upsert({
        key: 'ai_monitoring_enabled',
        value: enabled,
        updated_at: new Date().toISOString(),
      });

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, enabled });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error saving monitoring settings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
