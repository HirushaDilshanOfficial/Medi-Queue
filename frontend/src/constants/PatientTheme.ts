// Medi-Queue — Patient module theme
// Palette values are extracted directly from the Figma exports in HighFedilityUI/,
// so this file intentionally does not reuse the shared Colors.ts palette.

export const PatientTheme = {
  // Brand
  brandDeep: '#004C5B',
  brand: '#00696E',
  brandMid: '#1A6779',
  brandRaised: '#176577',
  accent: '#84F4FB',
  accentSoft: '#B6EBFB',

  // Neutrals
  background: '#F3FAFF',
  surface: '#FFFFFF',
  surfaceMuted: '#E6F6FF',
  surfaceCool: '#E0F0F9',
  border: '#DAEBF3',
  borderStrong: '#CAD0D5',

  // Text
  textPrimary: '#0E1E23',
  textSecondary: '#6F797C',
  textOnBrand: '#FFFFFF',
  textMuted: '#A9B4B8',

  // Status
  success: '#1F9D6B',
  successSoft: '#E4F6EE',
  warning: '#C87F0A',
  warningSoft: '#FDF3E2',
  danger: '#C0392B',
  dangerSoft: '#FBEAE8',
  info: '#00696E',
  infoSoft: '#E6F6FF',

  // Gradients
  gradientQueue: ['#0E1E23', '#004C5B', '#00696E'] as const,
  gradientHeader: ['#004C5B', '#00696E'] as const,
  gradientAccent: ['#00696E', '#1A6779'] as const,
  gradientCard: ['#FFFFFF', '#F3FAFF'] as const,

  // Radii
  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
  radiusXl: 22,
  radiusPill: 999,

  // Spacing
  spaceXs: 4,
  spaceSm: 8,
  spaceMd: 12,
  spaceLg: 16,
  spaceXl: 24,
  spaceXxl: 32,

  // Type scale
  fontSizeDisplay: 34,
  fontSizeTitle: 24,
  fontSizeHeading: 18,
  fontSizeSubheading: 16,
  fontSizeBody: 14,
  fontSizeCaption: 12,
  fontSizeMicro: 10,

  // Shadows
  shadowCard: {
    shadowColor: '#004C5B',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  shadowRaised: {
    shadowColor: '#0E1E23',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;

export type PatientColors = typeof PatientTheme;
