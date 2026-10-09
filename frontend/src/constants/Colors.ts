// Medi-Queue App - Color Palette
// Design: Government OPD Queue Management System
// Theme: Teal / Healthcare

export const Colors = {
  // Brand Colors
  primary: '#004C5B',         // Deep healthcare teal
  secondary: '#176577',       // Medium healthcare teal
  tint: '#E6F6FF',            // Light ice tint

  // Existing theme variants for backward compatibility
  primaryDark: '#0a6e7e',     // Dark teal header background
  primaryLight: '#1aacbf',    // Light teal for buttons
  primaryFaded: '#e0f5f8',    // Very light teal for card backgrounds

  // Neutral & Surfaces
  white: '#ffffff',
  background: '#f4f9fb',      // Light off-white background
  cardBackground: '#ffffff',  // White cards

  // Text Colors
  text: '#0d2e35',            // Primary text
  textDark: '#0d2e35',        // Dark text (headings)
  textMedium: '#4a6572',      // Medium grey text (subtitles)
  textLight: '#7a9aa6',       // Light grey text (hints)
  textWhite: '#ffffff',       // White text (on teal background)

  // Status Colors
  success: '#10B981',         // Success green (also #27ae60 compatible)
  warning: '#F59E0B',         // Warning amber
  danger: '#EF4444',          // Danger red
  error: '#EF4444',           // Error red (compatible with existing code)
  info: '#0e8fa3',

  // Border & Divider
  border: '#d0e8ed',
  divider: '#e8f4f7',

  // Shadow (for cards)
  shadow: 'rgba(10, 110, 126, 0.12)',
};

// Direct named exports for flexibility
export const primary = Colors.primary;
export const secondary = Colors.secondary;
export const tint = Colors.tint;
export const success = Colors.success;
export const warning = Colors.warning;
export const danger = Colors.danger;
export const text = Colors.text;
export const border = Colors.border;
export const white = Colors.white;

export default Colors;
