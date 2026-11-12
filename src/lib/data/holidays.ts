import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/data/profile';
import type { Holiday } from '@/lib/supabase/types';

export async function getHolidays(year?: number): Promise<Holiday[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from('holidays')
    .select('*')
    .order('holiday_date', { ascending: true });

  if (year) {
    query = query
      .gte('holiday_date', `${year}-01-01`)
      .lte('holiday_date', `${year}-12-31`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching holidays:', error);
    return [];
  }

  return (data ?? []) as Holiday[];
}

export async function addHoliday(holiday_date: string, name: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { isMaster, userId } = await getCurrentUserProfile();
  if (!isMaster || !userId) return { success: false, error: 'Hanya Akun Master yang diizinkan menambah hari libur.' };

  const { error } = await supabase.from('holidays').insert({
    user_id: userId,
    holiday_date,
    name: name.trim(),
  });

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Tanggal merah untuk tanggal ini sudah ada.' };
    }
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function deleteHoliday(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { isMaster } = await getCurrentUserProfile();
  if (!isMaster) return { success: false, error: 'Hanya Akun Master yang diizinkan menghapus hari libur.' };

  const { error } = await supabase
    .from('holidays')
    .delete()
    .eq('id', id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
