import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import type { ColorValue } from 'react-native';

// Medi-Queue patient icon set.
//
// Original 24x24 stroke artwork authored for this project. Every icon shares
// the same grid, 1.8 stroke weight and round caps/joins so the set reads as one
// family, and every icon is tintable through `color` (no baked-in fills), which
// is why these replace the previous fixed-colour PNG assets.

export type PatientIconProps = {
  size?: number;
  color?: ColorValue;
  strokeWidth?: number;
};

const DEFAULT_COLOR = '#002B4C';
const DEFAULT_STROKE = 1.8;

type FrameProps = PatientIconProps & { children: React.ReactNode };

function Frame({ size = 24, color = DEFAULT_COLOR, strokeWidth = DEFAULT_STROKE, children }: FrameProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

export function ArrowIcon(props: PatientIconProps) {
  return (
    <Frame {...props}>
      <Path d="M9.5 5.5 16 12l-6.5 6.5" />
    </Frame>
  );
}

export function BadgeIcon(props: PatientIconProps) {
  const color = props.color ?? DEFAULT_COLOR;
  return (
    <Frame {...props}>
      <Circle cx={12} cy={9.2} r={4.7} />
      <Circle cx={12} cy={9.2} r={1.5} fill={color} stroke="none" />
      <Path d="M8.4 13.1 6.6 20.8 12 18.1l5.4 2.7-1.8-7.7" />
    </Frame>
  );
}

export function BellIcon(props: PatientIconProps) {
  return (
    <Frame {...props}>
      <Path d="M18.2 9.4a6.2 6.2 0 1 0-12.4 0c0 6.1-2.3 7.7-2.3 7.7h17s-2.3-1.6-2.3-7.7Z" />
      <Path d="M13.9 20.1a2.2 2.2 0 0 1-3.8 0" />
    </Frame>
  );
}

export function BrainIcon(props: PatientIconProps) {
  return (
    <Frame {...props}>
      <Path d="M12 6.2a3 3 0 0 0-5.6-1.2A2.9 2.9 0 0 0 4 10.3a2.9 2.9 0 0 0 .5 4.4A2.9 2.9 0 0 0 7.6 19a2.7 2.7 0 0 0 4.4 1.2Z" />
      <Path d="M12 6.2a3 3 0 0 1 5.6-1.2A2.9 2.9 0 0 1 20 10.3a2.9 2.9 0 0 1-.5 4.4A2.9 2.9 0 0 1 16.4 19a2.7 2.7 0 0 1-4.4 1.2Z" />
      <Path d="M12 6.2v14" />
    </Frame>
  );
}

export function CalendarIcon(props: PatientIconProps) {
  const color = props.color ?? DEFAULT_COLOR;
  return (
    <Frame {...props}>
      <Path d="M4.8 6.4h14.4a1.2 1.2 0 0 1 1.2 1.2v11.6a1.2 1.2 0 0 1-1.2 1.2H4.8a1.2 1.2 0 0 1-1.2-1.2V7.6a1.2 1.2 0 0 1 1.2-1.2Z" />
      <Path d="M3.6 10.6h16.8" />
      <Path d="M8.2 4.2v4M15.8 4.2v4" />
      <Circle cx={8.6} cy={14.6} r={1.1} fill={color} stroke="none" />
    </Frame>
  );
}

export function ChildIcon(props: PatientIconProps) {
  return (
    <Frame {...props}>
      <Circle cx={12} cy={8.4} r={3.5} />
      <Path d="M12.6 5.1c1.3-.7 2.7 0 2.8 1.3" />
      <Path d="M6.6 20.4a5.4 5.4 0 0 1 10.8 0" />
    </Frame>
  );
}

export function ClipboardIcon(props: PatientIconProps) {
  return (
    <Frame {...props}>
      <Path d="M8.4 4.4H6.6a1.6 1.6 0 0 0-1.6 1.6v12.8a1.6 1.6 0 0 0 1.6 1.6h10.8a1.6 1.6 0 0 0 1.6-1.6V6a1.6 1.6 0 0 0-1.6-1.6h-1.8" />
      <Path d="M9.6 2.9h4.8a1 1 0 0 1 1 1v1.6a1 1 0 0 1-1 1H9.6a1 1 0 0 1-1-1V3.9a1 1 0 0 1 1-1Z" />
      <Path d="M12 10.4v4.4M9.8 12.6h4.4" />
    </Frame>
  );
}

export function ClockIcon(props: PatientIconProps) {
  return (
    <Frame {...props}>
      <Circle cx={12} cy={12} r={8.6} />
      <Path d="M12 6.9V12l3.4 2.1" />
    </Frame>
  );
}

export function EarIcon(props: PatientIconProps) {
  return (
    <Frame {...props}>
      <Path d="M6.6 9.4a5.4 5.4 0 1 1 10.8 0c0 2.4-1.5 3.7-2.8 4.8-1.1.9-1.5 1.7-1.5 2.8a2.6 2.6 0 0 1-5.2.5" />
      <Path d="M10.2 9.6a1.9 1.9 0 0 1 3.7.8c0 1.3-1.7 1.7-1.7 3.2" />
    </Frame>
  );
}

export function EyeIcon(props: PatientIconProps) {
  return (
    <Frame {...props}>
      <Path d="M2.4 12S6 5.9 12 5.9 21.6 12 21.6 12 18 18.1 12 18.1 2.4 12 2.4 12Z" />
      <Circle cx={12} cy={12} r={3.1} />
    </Frame>
  );
}

export function HeartIcon(props: PatientIconProps) {
  return (
    <Frame {...props}>
      <Path d="M12 20.4S3.6 15.1 3.6 9.9A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 8.4 2.5c0 5.2-8.4 10.5-8.4 10.5Z" />
    </Frame>
  );
}

export function HelpIcon(props: PatientIconProps) {
  const color = props.color ?? DEFAULT_COLOR;
  return (
    <Frame {...props}>
      <Circle cx={12} cy={12} r={8.6} />
      <Path d="M9.6 9.5a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.5" />
      <Circle cx={12} cy={17.2} r={1.05} fill={color} stroke="none" />
    </Frame>
  );
}

export function HomeIcon(props: PatientIconProps) {
  return (
    <Frame {...props}>
      <Path d="M3.6 10.6 12 3.7l8.4 6.9v9.3a1.1 1.1 0 0 1-1.1 1.1h-4.5v-6.1H9.2V21H4.7a1.1 1.1 0 0 1-1.1-1.1Z" />
    </Frame>
  );
}

export function HourglassIcon(props: PatientIconProps) {
  return (
    <Frame {...props}>
      <Path d="M6.4 3.4h11.2M6.4 20.6h11.2" />
      <Path d="M7.6 3.4v3.3c0 2.1 4.4 3.6 4.4 5.3s-4.4 3.2-4.4 5.3v3.3" />
      <Path d="M16.4 3.4v3.3c0 2.1-4.4 3.6-4.4 5.3s4.4 3.2 4.4 5.3v3.3" />
    </Frame>
  );
}

export function KidneyIcon(props: PatientIconProps) {
  return (
    <Frame {...props}>
      <Path d="M10.4 3.6c4 0 7.2 3.5 7.2 8s-3.4 8.6-7.7 8.6c-3.3 0-5.7-2.4-5.7-5.8 0-2.2 1.3-3.7 3-4.5 1.1-.5 1.7-1.2 1.7-2.1 0-1-.8-1.6-1.9-2-1-.3-1.6-.8-1.6-1.6 0-.9.7-1.6 2-1.6h3Z" />
      <Path d="M11.9 20.2c.1.9.7 1.5 1.7 1.7" />
    </Frame>
  );
}

export function MedicalIcon(props: PatientIconProps) {
  const color = props.color ?? DEFAULT_COLOR;
  return (
    <Frame {...props}>
      <Path d="M5.6 3.4h12.8a2.2 2.2 0 0 1 2.2 2.2v12.8a2.2 2.2 0 0 1-2.2 2.2H5.6a2.2 2.2 0 0 1-2.2-2.2V5.6a2.2 2.2 0 0 1 2.2-2.2Z" />
      <Path
        d="M10.7 7.4h2.6v3.3h3.3v2.6h-3.3v3.3h-2.6v-3.3H7.4v-2.6h3.3Z"
        fill={color}
        stroke="none"
      />
    </Frame>
  );
}

export function MindIcon(props: PatientIconProps) {
  const color = props.color ?? DEFAULT_COLOR;
  return (
    <Frame {...props}>
      <Path d="M12 3.4a6.5 6.5 0 0 0-6.5 6.5c0 2.3 1.1 4.3 2.9 5.5v3.1a1.5 1.5 0 0 0 1.5 1.5h4.2a1.5 1.5 0 0 0 1.5-1.5v-3.1a6.5 6.5 0 0 0 2.9-5.5A6.5 6.5 0 0 0 12 3.4Z" />
      <Path d="M12 8.6v4.6" />
      <Path d="M12 11.2c0-1.4-1.1-2.5-2.5-2.5 0 1.4 1.1 2.5 2.5 2.5Z" fill={color} stroke="none" />
      <Path d="M12 10.4c0-1.4 1.1-2.5 2.5-2.5 0 1.4-1.1 2.5-2.5 2.5Z" fill={color} stroke="none" />
    </Frame>
  );
}

export function PillIcon(props: PatientIconProps) {
  // Geometry is written out directly rather than using a rotate transform, so
  // the capsule is identical on every renderer.
  return (
    <Frame {...props}>
      <Path d="M10.59 19.07 19.07 10.59A4 4 0 0 0 13.41 4.93L4.93 13.41A4 4 0 0 0 10.59 19.07Z" />
      <Path d="M9.17 9.17 14.83 14.83" />
    </Frame>
  );
}

export function ProfileIcon(props: PatientIconProps) {
  return (
    <Frame {...props}>
      <Circle cx={12} cy={8.2} r={3.7} />
      <Path d="M5 20.6a7.2 7.2 0 0 1 14 0" />
    </Frame>
  );
}

export function ScreeningIcon(props: PatientIconProps) {
  const color = props.color ?? DEFAULT_COLOR;
  return (
    <Frame {...props}>
      <Path d="M9.2 3.2h5.6" />
      <Path d="M10.2 3.2v9.9a3.8 3.8 0 0 0 7.6 0V3.2" />
      <Path d="M10.2 8.6h7.6" />
      <Circle cx={13.3} cy={12.5} r={0.95} fill={color} stroke="none" />
      <Circle cx={15.4} cy={15.1} r={0.7} fill={color} stroke="none" />
    </Frame>
  );
}

export function SearchIcon(props: PatientIconProps) {
  return (
    <Frame {...props}>
      <Circle cx={10.8} cy={10.8} r={6.6} />
      <Path d="M15.6 15.6 20.4 20.4" />
    </Frame>
  );
}

export function SpineIcon(props: PatientIconProps) {
  return (
    <Frame {...props}>
      <Path d="M9.2 5.8h5.6M9.2 9.8h5.6M9.2 13.8h5.6M9.2 17.8h5.6" />
      <Path d="M12 4.6v14.8" />
    </Frame>
  );
}

export function StethoscopeIcon(props: PatientIconProps) {
  return (
    <Frame {...props}>
      <Path d="M5.6 3.4v5.5a3.9 3.9 0 0 0 7.8 0V3.4" />
      <Path d="M5.6 3.4H4M13.4 3.4H15" />
      <Path d="M9.5 12.8v1.9a4.5 4.5 0 0 0 9 0v-1.7" />
      <Circle cx={18.5} cy={11} r={2.1} />
    </Frame>
  );
}

export function TicketIcon(props: PatientIconProps) {
  return (
    <Frame {...props}>
      <Path d="M3.4 8.5V6.7a1.3 1.3 0 0 1 1.3-1.3h14.6a1.3 1.3 0 0 1 1.3 1.3v1.8a2.15 2.15 0 0 0 0 4.3v1.8a1.3 1.3 0 0 1-1.3 1.3H4.7a1.3 1.3 0 0 1-1.3-1.3v-1.8a2.15 2.15 0 0 0 0-4.3Z" />
      <Path d="M12 8.1v1.5M12 11.25v1.5M12 14.4v1.5" />
    </Frame>
  );
}

export const patientIcons = {
  arrow: ArrowIcon,
  badge: BadgeIcon,
  bell: BellIcon,
  brain: BrainIcon,
  calendar: CalendarIcon,
  child: ChildIcon,
  clipboard: ClipboardIcon,
  clock: ClockIcon,
  ear: EarIcon,
  eye: EyeIcon,
  heart: HeartIcon,
  help: HelpIcon,
  home: HomeIcon,
  hourglass: HourglassIcon,
  kidney: KidneyIcon,
  medical: MedicalIcon,
  mind: MindIcon,
  pill: PillIcon,
  profile: ProfileIcon,
  screening: ScreeningIcon,
  search: SearchIcon,
  spine: SpineIcon,
  stethoscope: StethoscopeIcon,
  ticket: TicketIcon,
} as const;

export type PatientIconName = keyof typeof patientIcons;
