import React from 'react';
import { View, Image, ImageStyle, ViewStyle, StyleProp, StyleSheet } from 'react-native';

export type SultanLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';
export type SultanLogoVariant = 'bare' | 'badge' | 'circle';

interface SultanLogoProps {
  size?: SultanLogoSize;
  variant?: SultanLogoVariant;
  width?: number;
  height?: number;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}

const SIZE_MAP: Record<SultanLogoSize, { imgW: number; imgH: number; box: number; radius: number }> = {
  xs: { imgW: 32, imgH: 32, box: 38, radius: 8 },
  sm: { imgW: 46, imgH: 46, box: 54, radius: 12 },
  md: { imgW: 84, imgH: 84, box: 96, radius: 18 },
  lg: { imgW: 130, imgH: 130, box: 150, radius: 26 },
  xl: { imgW: 200, imgH: 190, box: 220, radius: 34 },
  hero: { imgW: 380, imgH: 340, box: 400, radius: 44 },
};

export default function SultanLogo({
  size = 'md',
  variant = 'bare',
  width,
  height,
  style,
  containerStyle,
}: SultanLogoProps) {
  const meta = SIZE_MAP[size] || SIZE_MAP.md;
  const finalWidth = width ?? meta.imgW;
  const finalHeight = height ?? meta.imgH;

  const imageElem = (
    <Image
      source={require('../../assets/images/sultan-logo.png')}
      style={[
        {
          width: finalWidth,
          height: finalHeight,
        },
        style,
      ]}
      resizeMode="contain"
    />
  );

  if (variant === 'bare') {
    return imageElem;
  }

  const isCircle = variant === 'circle';
  const boxDim = Math.max(meta.box, finalWidth + 16, finalHeight + 16);
  const borderRadius = isCircle ? boxDim / 2 : meta.radius;

  return (
    <View
      style={[
        styles.badgeContainer,
        {
          width: boxDim,
          height: boxDim,
          borderRadius,
        },
        containerStyle,
      ]}
    >
      {imageElem}
    </View>
  );
}

const styles = StyleSheet.create({
  badgeContainer: {
    backgroundColor: '#440112', // Kanaf Deep Wine Burgundy
    borderWidth: 2,
    borderColor: '#FFE0CB', // Kanaf Cream Wheat Border
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FFE0CB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
});
