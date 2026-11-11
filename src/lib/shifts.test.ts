import { getRequiredShifts } from './shifts';

function assertEqual(actual: unknown, expected: unknown, testName: string) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr === expectedStr) {
    console.log(`✓ ${testName} PASSED: ${actualStr}`);
  } else {
    console.error(`✗ ${testName} FAILED! Expected ${expectedStr}, got ${actualStr}`);
    process.exit(1);
  }
}

// 2026-10-07 is Wednesday
const wednesday = '2026-10-07';
// 2026-10-10 is Saturday
const saturday = '2026-10-10';
// 2026-10-11 is Sunday
const sunday = '2026-10-11';

// Test 1: Rabu non-libur -> ['malam']
assertEqual(getRequiredShifts(wednesday, new Set()), ['malam'], 'Rabu non-libur');

// Test 2: Sabtu -> ['pagi', 'malam']
assertEqual(getRequiredShifts(saturday, new Set()), ['pagi', 'malam'], 'Sabtu');

// Test 3: Minggu -> ['pagi', 'malam']
assertEqual(getRequiredShifts(sunday, new Set()), ['pagi', 'malam'], 'Minggu');

// Test 4: Rabu yang dimasukkan ke holidays -> ['pagi', 'malam']
const holidaysWithWed = new Set([wednesday]);
assertEqual(getRequiredShifts(wednesday, holidaysWithWed), ['pagi', 'malam'], 'Rabu tanggal merah');

console.log('Semua uji shift logic sukses!');
