/**
 * Plain-node test for validators.js — no external libraries needed.
 * Run:  node utils/validators.test.js
 */
const {
  isValidNIC,
  isValidSLPhone,
  normalizePhone,
  normalizeNIC,
  isValidDate,
  isValidSlot,
} = require('./validators');

let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
  const ok = actual === expected;
  if (ok) {
    passed++;
    console.log(`  ✔ ${label}`);
  } else {
    failed++;
    console.log(`  ✘ ${label}  (expected ${expected}, got ${actual})`);
  }
}

// ──────────────────────────────────
console.log('\n=== isValidNIC ===');

// Valid NICs
assert('Old format with V',         isValidNIC('912345678V'), true);
assert('Old format with X',         isValidNIC('912345678x'), true);
assert('Old format lowercase v',    isValidNIC('123456789v'), true);
assert('New format 12 digits',      isValidNIC('200012345678'), true);
assert('New format all zeros',      isValidNIC('000000000000'), true);
assert('Old with leading whitespace', isValidNIC(' 912345678V '), true);

// Invalid NICs
assert('Too short',                 isValidNIC('12345678V'), false);
assert('Too long old format',       isValidNIC('1234567890V'), false);
assert('Letters in new format',     isValidNIC('20001234567A'), false);
assert('11 digits',                 isValidNIC('12345678901'), false);
assert('Empty string',              isValidNIC(''), false);
assert('Number input',              isValidNIC(912345678), false);

// ──────────────────────────────────
console.log('\n=== isValidSLPhone ===');

// Valid phones
assert('Local 07X format',          isValidSLPhone('0771234567'), true);
assert('+94 format',                isValidSLPhone('+94771234567'), true);
assert('94 without plus',           isValidSLPhone('94771234567'), true);
assert('Local 011 format',          isValidSLPhone('0112345678'), true);
assert('With leading space',        isValidSLPhone(' 0771234567 '), true);

// Invalid phones
assert('Missing leading 0',         isValidSLPhone('771234567'), false);
assert('Too short',                 isValidSLPhone('077123456'), false);
assert('Too long',                  isValidSLPhone('07712345678'), false);
assert('Starts with 00',            isValidSLPhone('0071234567'), false);
assert('Contains letters',          isValidSLPhone('077abc4567'), false);
assert('Empty string',              isValidSLPhone(''), false);

// ──────────────────────────────────
console.log('\n=== normalizePhone ===');

assert('Local → 0XXXXXXXXX',        normalizePhone('0771234567'), '0771234567');
assert('+94  → 0XXXXXXXXX',         normalizePhone('+94771234567'), '0771234567');
assert('94   → 0XXXXXXXXX',         normalizePhone('94771234567'), '0771234567');
assert('011  → 0XXXXXXXXX',         normalizePhone('0112345678'), '0112345678');
assert('Invalid returns null',       normalizePhone('12345'), null);

// ──────────────────────────────────
console.log('\n=== normalizeNIC ===');

assert('Uppercase + trim',          normalizeNIC(' 912345678v '), '912345678V');
assert('Already uppercase',         normalizeNIC('912345678X'), '912345678X');
assert('New format pass-through',   normalizeNIC('200012345678'), '200012345678');
assert('Null input returns null',   normalizeNIC(null), null);
assert('Number input returns null', normalizeNIC(123), null);

// ──────────────────────────────────
console.log('\n=== isValidDate ===');

// Valid dates
assert('Normal date',               isValidDate('2026-10-01'), true);
assert('Leap year Feb 29',          isValidDate('2024-02-29'), true);
assert('Year boundary',             isValidDate('2000-01-01'), true);
assert('December 31',               isValidDate('2026-12-31'), true);
assert('Month 06',                  isValidDate('2026-06-15'), true);

// Invalid dates
assert('Feb 30 (impossible)',       isValidDate('2026-02-30'), false);
assert('Month 13',                  isValidDate('2026-13-01'), false);
assert('Day 00',                    isValidDate('2026-01-00'), false);
assert('Wrong format D/M/Y',        isValidDate('01/10/2026'), false);
assert('Missing leading zero',      isValidDate('2026-1-01'), false);
assert('Empty string',              isValidDate(''), false);

// ──────────────────────────────────
console.log('\n=== isValidSlot ===');

// Valid slots
assert('Morning slot',              isValidSlot('08:00'), true);
assert('Midnight',                  isValidSlot('00:00'), true);
assert('Last minute of day',        isValidSlot('23:59'), true);
assert('Afternoon',                 isValidSlot('14:30'), true);
assert('Evening',                   isValidSlot('18:45'), true);

// Invalid slots
assert('Hour 24',                   isValidSlot('24:00'), false);
assert('Minute 60',                 isValidSlot('12:60'), false);
assert('No colon',                  isValidSlot('0800'), false);
assert('Single digit hour',         isValidSlot('8:00'), false);
assert('With seconds',              isValidSlot('08:00:00'), false);
assert('Empty string',              isValidSlot(''), false);

// ──────────────────────────────────
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(40));
process.exit(failed > 0 ? 1 : 0);
