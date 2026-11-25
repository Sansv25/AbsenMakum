'use server';

import { revalidatePath } from 'next/cache';
import {
  saveEmailRecapSettings,
  sendRecapEmailNow,
  sendDailyRecapEmailNow,
  type EmailRecapSettings,
} from '@/lib/data/email-recap';

export async function saveRecapSettingsAction(
  settings: Partial<EmailRecapSettings>
): Promise<{ success: boolean; error?: string }> {
  const res = await saveEmailRecapSettings(settings);
  if (res.success) {
    revalidatePath('/pengaturan/rekapan');
    revalidatePath('/rekap-harian');
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

export async function sendDailyRecapNowAction(
  date?: string,
  overrideRecipients?: string[],
  forceSendOnHoliday = false,
  isTest = false
): Promise<{ success: boolean; message?: string; error?: string; isHolidaySkipped?: boolean }> {
  const res = await sendDailyRecapEmailNow(
    date,
    overrideRecipients,
    forceSendOnHoliday,
    false,
    null,
    { isTest }
  );
  revalidatePath('/pengaturan/rekapan');
  revalidatePath('/rekap-harian');
  return res;
}

