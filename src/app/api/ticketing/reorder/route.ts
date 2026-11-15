import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('ticketing_settings')
      .select('value')
      .eq('key', 'queue_order')
      .maybeSingle();

    const ticketIds = Array.isArray(data?.value) ? data.value : [];
    return NextResponse.json({ ticketIds });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching queue order';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ticketIds: string[] = Array.isArray(body.ticketIds) ? body.ticketIds : [];

    const supabase = await createClient();
    const { error } = await supabase
      .from('ticketing_settings')
      .upsert({
        key: 'queue_order',
        value: ticketIds,
        updated_at: new Date().toISOString(),
      });

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, ticketIds });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error saving queue order';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
