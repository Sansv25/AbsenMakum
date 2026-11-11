import { createClient } from '@/lib/supabase/server';
import type { ShiftSetting, ShiftType } from '@/lib/supabase/types';

const DEFAULT_SETTINGS: { shift_type: ShiftType; start_time: string; end_time: string }[] = [
  { shift_type: 'pagi', start_time: '06:00:00', end_time: '14:00:00' },
  { shift_type: 'malam', start_time: '14:00:00', end_time: '22:00:00' },
];

export async function getOrInitShiftSettings(): Promise<ShiftSetting[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('shift_settings')
    .select('*')
    .eq('user_id', user.id);

  if (error) {
    console.error('Error fetching shift settings:', error);
    return [];
  }

  const existing = (data ?? []) as ShiftSetting[];
  if (existing.length === 2) {
    return existing;
  }

  // Jika belum ada lengkap, inisialisasi default
  for (const def of DEFAULT_SETTINGS) {
    const exists = existing.some((s) => s.shift_type === def.shift_type);
    if (!exists) {
      await supabase.from('shift_settings').insert({
        user_id: user.id,
        shift_type: def.shift_type,
        start_time: def.start_time,
        end_time: def.end_time,
      });
    }
  }

  const { data: fresh } = await supabase
    .from('shift_settings')
    .select('*')
    .eq('user_id', user.id);

  return (fresh ?? []) as ShiftSetting[];
}

export async function updateShiftSetting(
  shift_type: ShiftType,
  start_time: string,
  end_time: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Tidak terautentikasi' };

  const { error } = await supabase
    .from('shift_settings')
    .upsert({
      user_id: user.id,
      shift_type,
      start_time: start_time.length === 5 ? `${start_time}:00` : start_time,
      end_time: end_time.length === 5 ? `${end_time}:00` : end_time,
    }, {
      onConflict: 'user_id,shift_type',
    });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
