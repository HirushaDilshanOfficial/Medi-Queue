// Medi-Queue — Patient module theme
//
// Design tokens are derived from the public Asiri Health design language
// (asirihealth.com -> public/frontend/asiri_health/css/asiri.css) and adapted
// for a mobile-first patient app. This file intentionally does not reuse the
// shared Colors.ts palette.
//
// Attribution note: Medi-Queue is not affiliated with or endorsed by Asiri
// Health. Only the generic visual language (navy/teal palette, heavy display
// weights, pill controls, hairline cyan rules) is borrowed. All Medi-Queue
// artwork and naming is original.

export const PatientTheme = {
  // Brand — navy is the structural colour, teal is the accent.
  brand: '#002B4C',
  brandDeep: '#001A2E',
  brandRaised: '#0D2E4F',
  brandHover: '#0D5CA3',
  brandMid: '#3FBCB9',
  accent: '#47CCC8',
  accentSoft: '#62D2C3',
  brandSky: '#8393CA',

  // Decorative hairline. Asiri uses a 2px cyan rule under navy bars and beside
  // stat boxes. Pure cyan fails contrast on white, so this is for borders and
  // dividers only — never for text or icons on a light surface.
  accentLine: '#00FFFF',

  // Neutrals
  background: '#F4F6F8',
  surface: '#FFFFFF',
  surfaceMuted: '#F5F5F5',
  surfaceCool: '#EAF7F6',
  surfaceTint: '#EDF1F7',
  border: '#E4E7EA',
  borderStrong: '#CAD0D5',

  // Text — Asiri sets headings in navy and body copy in near-black.
  textPrimary: '#002B4C',
  textSecondary: '#5A6570',
  textOnBrand: '#FFFFFF',
  textMuted: '#999999',

  // Status
  success: '#1F9D6B',
  successSoft: '#E4F6EE',
  warning: '#E5A748',
  warningSoft: '#FDF3E2',
  danger: '#E23B3B',
  dangerSoft: '#FBEAE8',
  // Asiri reserves a hotter red for the emergency hotline (1313) and the
  // Accident & Emergency entry point.
  emergency: '#FF2525',
  emergencySoft: '#FDE8E8',
  info: '#3FBCB9',
  infoSoft: '#EAF7F6',

  // Gradients
  gradientQueue: ['#002B4C', '#0D2E4F', '#0D5CA3'] as const,
  gradientHeader: ['#002B4C', '#0D2E4F'] as const,
  gradientAccent: ['#47CCC8', '#3FBCB9'] as const,
  gradientCard: ['#FFFFFF', '#F7FAFC'] as const,

  // Radii — Asiri uses ~10px cards and fully rounded pill controls.
  radiusSm: 6,
  radiusMd: 10,
  radiusLg: 14,
  radiusXl: 20,
  radiusPill: 999,

  // Spacing
  spaceXs: 4,
  spaceSm: 8,
  spaceMd: 12,
  spaceLg: 16,
  spaceXl: 24,
  spaceXxl: 32,

  // Type scale (legacy, kept for the other patient screens)
  fontSizeDisplay: 34,
  fontSizeTitle: 24,
  fontSizeHeading: 18,
  fontSizeSubheading: 16,
  fontSizeBody: 14,
  fontSizeCaption: 12,
  fontSizeMicro: 10,

  // Type scale used by the dashboard, doctors, queue and profile screens.
  designType: {
    hero: 24,
    section: 17,
    item: 15,
    body: 13,
    caption: 11,
  } as const,

  // Asiri leans on very heavy display weights (700-900) for headings, buttons
  // and uppercase labels. Centralised so screens stay consistent.
  weight: {
    heavy: '900',
    bold: '800',
    semibold: '700',
    medium: '600',
    regular: '400',
  } as const,

  // Shadows — Asiri leans on a soft navy-tinted drop shadow
  // (0 .5rem 1rem rgba(0,0,0,.15)).
  shadowCard: {
    shadowColor: '#002B4C',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  shadowRaised: {
    shadowColor: '#001A2E',
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
} as const;

export type PatientColors = typeof PatientTheme;
