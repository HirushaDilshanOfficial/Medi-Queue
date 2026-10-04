import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { DesignImage, type DesignImageName } from './DesignImage';

const paths = {
  back: 'M20 12H4m6-6-6 6 6 6',
  more: 'M12 5h.01M12 12h.01M12 19h.01',
  info: 'M12 11v6m0-10h.01',
  refresh: 'M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 14-2l1 2M4 16l1 2a8 8 0 0 0 14-2',
  wallet: 'M3 6h16V3H5a2 2 0 0 0-2 2v15h18V6H3Zm18 5h-6v5h6m-3-3h.01',
  share: 'm8 11 8-5M8 13l8 5',
  phone: 'M7 3H3c0 10 8 18 18 18v-4l-5-2-2 3a17 17 0 0 1-8-8l3-2-2-5Z',
  edit: 'M14 5l5 5M4 20l4-1 12-12a2 2 0 0 0-5-5L3 14l-1 6Z',
  download: 'M12 3v12m-4-4 4 4 4-4M5 17v4h14v-4',
  logout: 'M9 4H4v16h5m-1-8h13m-4-4 4 4-4 4',
  family: 'M4 21v-7m4 7v-7m-6-1a4 4 0 0 1 8 0m5 8v-7m4 7v-7m-6-1a4 4 0 0 1 8 0M10 18h4',
  emergency: 'M12 7v6m0 3v1M4 19l7-14a1 1 0 0 1 2 0l7 14H4ZM3 8 1 6m20 2 2-2',
  language: 'M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18Z',
  folder: 'M3 6h7l2 2h9v12H3V6Zm9 6v5m-2-3 2-2 2 2',
  notes: 'M15 3H5v18h14V7l-4-4Zm0 0v5h4M8 12h8m-8 4h5',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12M18 6 6 18',
} as const;

export type ProfileIconName = DesignImageName | keyof typeof paths | 'qr';

export function ProfileIcon({ name, size = 20, color = '#004c5b' }: { name: ProfileIconName; size?: number; color?: string }) {
  if (name !== 'qr' && !(name in paths)) return <DesignImage name={name as DesignImageName} size={size} color={color} />;
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    {name === 'qr' ? <><Rect x={3} y={3} width={6} height={6} /><Rect x={15} y={3} width={6} height={6} /><Rect x={3} y={15} width={6} height={6} /><Path d="M13 13h4v4h4v4h-8v-4m8-4v1M6 6h.01M18 6h.01M6 18h.01" /></> : <Path d={paths[name as keyof typeof paths]} />}
    {name === 'language' ? <Circle cx={12} cy={12} r={9} /> : null}
    {name === 'family' ? <><Circle cx={6} cy={5} r={2} /><Circle cx={17} cy={5} r={2} /></> : null}
    {name === 'info' ? <Circle cx={12} cy={12} r={9} /> : null}
    {name === 'share' ? <><Circle cx={5} cy={12} r={3} /><Circle cx={19} cy={4} r={3} /><Circle cx={19} cy={20} r={3} /></> : null}
  </Svg>;
}
