import Swal from 'sweetalert2';

export const customSwal = Swal.mixin({
  customClass: {
    popup: 'rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 font-sans p-6',
    title: 'text-base font-bold text-gray-900 dark:text-slate-100 mb-2',
    htmlContainer: 'text-xs text-gray-600 dark:text-slate-300 leading-relaxed',
    confirmButton:
      'px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm mx-1.5 transition-colors',
    cancelButton:
      'px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 mx-1.5 transition-colors',
    denyButton:
      'px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 mx-1.5 transition-colors',
  },
  buttonsStyling: false,
});

export async function showAlert(
  title: string,
  text?: string,
  icon: 'success' | 'error' | 'warning' | 'info' = 'info'
) {
  return await customSwal.fire({
    title,
    text,
    icon,
    confirmButtonText: 'Tutup',
  });
}

export async function showConfirm(
  title: string,
  text?: string,
  confirmButtonText = 'Ya, Lanjutkan',
  isDanger = false
): Promise<boolean> {
  const result = await customSwal.fire({
    title,
    text,
    icon: isDanger ? 'warning' : 'question',
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText: 'Batal',
    reverseButtons: true,
    customClass: {
      popup: 'rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 font-sans p-6',
      title: 'text-base font-bold text-gray-900 dark:text-slate-100 mb-2',
      htmlContainer: 'text-xs text-gray-600 dark:text-slate-300 leading-relaxed',
      confirmButton: isDanger
        ? 'px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 shadow-sm mx-1.5 transition-colors'
        : 'px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm mx-1.5 transition-colors',
      cancelButton:
        'px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 mx-1.5 transition-colors',
    },
  });
  return result.isConfirmed;
}

export function showToast(title: string, icon: 'success' | 'error' | 'info' = 'success') {
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    customClass: {
      popup: 'rounded-xl shadow-lg border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 text-xs font-medium font-sans',
    },
  });
  Toast.fire({
    icon,
    title,
  });
}

export default customSwal;

