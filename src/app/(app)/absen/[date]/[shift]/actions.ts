'use server';

import {
  updateNote,
  claimDeviceForAttendance,
  lockAttendance,
  unlockAttendance,
  resetAttendanceDevice,
} from '@/lib/data/attendance';
import { revalidatePath } from 'next/cache';

export async function saveNoteAction(
  attendanceId: string,
  note: string,
  deviceId?: string,
  deviceInfo?: string
) {
  return await updateNote(attendanceId, note, deviceId, deviceInfo);
}

export async function claimDeviceAction(
  attendanceId: string,
  deviceId: string,
  deviceInfo: string
) {
  const result = await claimDeviceForAttendance(attendanceId, deviceId, deviceInfo);
  return result;
}

export async function lockAttendanceAction(
  attendanceId: string,
  date: string,
  shift: string,
  deviceId?: string
) {
  const result = await lockAttendance(attendanceId, deviceId);
  revalidatePath(`/absen/${date}/${shift}`);
  revalidatePath('/');
  revalidatePath('/riwayat');
  return result;
}

export async function unlockAttendanceAction(
  attendanceId: string,
  date: string,
  shift: string
) {
  const result = await unlockAttendance(attendanceId);
  revalidatePath(`/absen/${date}/${shift}`);
  revalidatePath('/');
  revalidatePath('/riwayat');
  return result;
}

export async function resetDeviceAction(
  attendanceId: string,
  date: string,
  shift: string
) {
  const result = await resetAttendanceDevice(attendanceId);
  revalidatePath(`/absen/${date}/${shift}`);
  return result;
}
