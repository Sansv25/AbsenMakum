'use server';

import { revalidatePath } from 'next/cache';
import {
  saveEmailRecapSettings,
  sendRecapEmailNow,
  type EmailRecapSettings,
} from '@/lib/data/email-recap';

export async function saveRecapSettingsAction(
  settings: Partial<EmailRecapSettings>
): Promise<{ success: boolean; error?: string }> {
  const res = await saveEmailRecapSettings(settings);
  if (res.success) {
    revalidatePath('/pengaturan/rekapan');
  }
  return res;
}

export async function sendRecapNowAction(
  periodType: 'mingguan' | 'bulanan'
): Promise<{ success: boolean; message?: string; error?: string }> {
  const res = await sendRecapEmailNow(periodType);
  revalidatePath('/pengaturan/rekapan');
  return res;
}

