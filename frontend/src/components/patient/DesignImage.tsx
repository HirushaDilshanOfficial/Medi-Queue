import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

// Metro resolves these statically, so every design asset must be listed here.
const SOURCES = {
  arrow: require('../../../assets/images/patient/arrow.png'),
  badge: require('../../../assets/images/patient/badge.png'),
  bell: require('../../../assets/images/patient/bell.png'),
  brain: require('../../../assets/images/patient/brain.png'),
  calendar: require('../../../assets/images/patient/calendar.png'),
  child: require('../../../assets/images/patient/child.png'),
  clipboard: require('../../../assets/images/patient/clipboard.png'),
  clock: require('../../../assets/images/patient/clock.png'),
  ear: require('../../../assets/images/patient/ear.png'),
  eye: require('../../../assets/images/patient/eye.png'),
  heart: require('../../../assets/images/patient/heart.png'),
  help: require('../../../assets/images/patient/help.png'),
  home: require('../../../assets/images/patient/home.png'),
  hourglass: require('../../../assets/images/patient/hourglass.png'),
  kidney: require('../../../assets/images/patient/kidney.png'),
  medical: require('../../../assets/images/patient/medical.png'),
  mind: require('../../../assets/images/patient/mind.png'),
  pill: require('../../../assets/images/patient/pill.png'),
  profile: require('../../../assets/images/patient/profile.png'),
  screening: require('../../../assets/images/patient/screening.png'),
  search: require('../../../assets/images/patient/search.png'),
  spine: require('../../../assets/images/patient/spine.png'),
  stethoscope: require('../../../assets/images/patient/stethoscope.png'),
  ticket: require('../../../assets/images/patient/ticket.png'),
  wellness: require('../../../assets/images/patient/wellness.png'),
} as const;

export type DesignImageName = keyof typeof SOURCES;

type Props = {
  name: DesignImageName;
  size?: number;
  style?: StyleProp<ImageStyle>;
};

export function DesignImage({ name, size, style }: Props) {
  return <Image source={SOURCES[name]} style={[{ width: size, height: size }, style]} resizeMode="contain" />;
}

export { SOURCES as designImageSources };
