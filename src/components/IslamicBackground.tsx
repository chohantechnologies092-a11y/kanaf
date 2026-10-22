import React from 'react';
import { View, StyleSheet, useWindowDimensions, StyleProp, ViewStyle, Image } from 'react-native';
import Svg, { Path, G, Polygon, Rect, Defs, RadialGradient, Stop } from 'react-native-svg';

interface IslamicBackgroundProps {
  theme?: 'burgundy' | 'light' | 'dark';
  children?: React.ReactNode;
  showCorners?: boolean;
  showCenterLattice?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

/**
 * Islamic Star Polygon (8-point Rub el Hizb / Khatim star)
 */
function EightPointStar({
  cx,
  cy,
  outerRadius,
  innerRadius,
  strokeColor,
  strokeWidth = 1.5,
  fill = 'none',
}: {
  cx: number;
  cy: number;
  outerRadius: number;
  innerRadius: number;
  strokeColor: string;
  strokeWidth?: number;
  fill?: string;
}) {
  const points: string[] = [];
  const totalPoints = 16; // 8 outer points, 8 inner points
  for (let i = 0; i < totalPoints; i++) {
    const angle = (i * Math.PI) / 8 - Math.PI / 2;
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    points.push(`${x},${y}`);
  }
  return (
    <Polygon
      points={points.join(' ')}
      fill={fill}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      strokeLinejoin="miter"
      strokeMiterlimit={4}
    />
  );
}

/**
 * Detailed Islamic Arabesque Corner Motif (matching Image 3)
 */
function CornerGeometricMotif({
  size = 180,
  color = '#D5A943',
  opacity = 0.85,
}: {
  size?: number;
  color?: string;
  opacity?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 180 180" style={{ opacity }}>
      <G stroke={color} fill="none">
        {/* Outer Corner Frame Borders */}
        <Path
          d="M 0,0 L 180,0 L 180,24 L 24,24 L 24,180 L 0,180 Z"
          strokeWidth={1.5}
          fill="none"
        />
        <Path
          d="M 12,12 L 175,12 M 12,12 L 12,175"
          strokeWidth={1}
          strokeDasharray="4 2"
        />
        <Path
          d="M 32,32 L 165,32 L 165,42 L 42,42 L 42,165 L 32,165 Z"
          strokeWidth={1.2}
        />

        {/* Outer Stepped Borders (Key pattern from Image 3) */}
        <Path
          d="M 160,0 L 160,18 L 140,18 L 140,36 L 120,36 L 120,54 L 100,54 L 100,72 L 72,72 L 72,100 L 54,100 L 54,120 L 36,120 L 36,140 L 18,140 L 18,160 M 0,160 L 18,160"
          strokeWidth={1.4}
        />

        {/* 8-Pointed Star Rosette at Main Corner Nexus */}
        <EightPointStar
          cx={96}
          cy={96}
          outerRadius={36}
          innerRadius={24}
          strokeColor={color}
          strokeWidth={1.6}
        />
        <EightPointStar
          cx={96}
          cy={96}
          outerRadius={22}
          innerRadius={14}
          strokeColor={color}
          strokeWidth={1.2}
        />
        <EightPointStar
          cx={96}
          cy={96}
          outerRadius={10}
          innerRadius={6}
          strokeColor={color}
          strokeWidth={1}
        />

        {/* Interlacing Cross & Diamond Accents */}
        <Path
          d="M 96,56 L 96,136 M 56,96 L 136,96"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
        <Path
          d="M 68,68 L 124,124 M 124,68 L 68,124"
          strokeWidth={0.8}
        />

        {/* Secondary Corner Stars */}
        <EightPointStar
          cx={32}
          cy={96}
          outerRadius={14}
          innerRadius={9}
          strokeColor={color}
          strokeWidth={1.2}
        />
        <EightPointStar
          cx={96}
          cy={32}
          outerRadius={14}
          innerRadius={9}
          strokeColor={color}
          strokeWidth={1.2}
        />
        <EightPointStar
          cx={148}
          cy={18}
          outerRadius={10}
          innerRadius={6}
          strokeColor={color}
          strokeWidth={1}
        />
        <EightPointStar
          cx={18}
          cy={148}
          outerRadius={10}
          innerRadius={6}
          strokeColor={color}
          strokeWidth={1}
        />
      </G>
    </Svg>
  );
}

export default function IslamicBackground({
  theme = 'burgundy',
  children,
  showCorners = true,
  showCenterLattice = true,
  style,
  contentContainerStyle,
}: IslamicBackgroundProps) {
  const { width } = useWindowDimensions();
  const cornerSize = width < 420 ? 80 : width < 768 ? 115 : 170;

  const isBurgundy = theme === 'burgundy';
  const isLight = theme === 'light';

  const bgColor = isBurgundy ? '#440112' : isLight ? '#FDF9F5' : '#190107';
  const goldStroke = isLight ? '#9E721D' : '#FFE0CB';
  const cornerOpacity = isBurgundy ? 0.75 : isLight ? 0.45 : 0.7;

  return (
    <View style={[styles.container, { backgroundColor: bgColor }, style]}>
      {/* Background Subtle Radial Gradient / Glow */}
      <View
        pointerEvents="none"
        style={[
          styles.glowCenter,
          {
            backgroundColor: isBurgundy
              ? 'rgba(213, 169, 67, 0.07)'
              : isLight
              ? 'rgba(213, 169, 67, 0.05)'
              : 'rgba(213, 169, 67, 0.04)',
          },
        ]}
      />

      {/* Center Subtle Geometric Watermark Lattice */}
      {showCenterLattice && (
        <Image
          source={require('../../assets/images/islamic-lattice-gold.png')}
          style={[
            styles.latticeOverlay,
            {
              opacity: isBurgundy ? 0.045 : isLight ? 0.03 : 0.035,
            },
          ]}
          resizeMode="repeat"
        />
      )}

      {/* Top-Left Islamic Arabesque Corner */}
      {showCorners && (
        <View pointerEvents="none" style={styles.cornerTopLeft}>
          <CornerGeometricMotif size={cornerSize} color={goldStroke} opacity={cornerOpacity} />
        </View>
      )}

      {/* Top-Right Islamic Arabesque Corner */}
      {showCorners && (
        <View pointerEvents="none" style={styles.cornerTopRight}>
          <CornerGeometricMotif size={cornerSize} color={goldStroke} opacity={cornerOpacity} />
        </View>
      )}

      {/* Bottom-Left Islamic Arabesque Corner */}
      {showCorners && (
        <View pointerEvents="none" style={styles.cornerBottomLeft}>
          <CornerGeometricMotif size={cornerSize} color={goldStroke} opacity={cornerOpacity} />
        </View>
      )}

      {/* Bottom-Right Islamic Arabesque Corner */}
      {showCorners && (
        <View pointerEvents="none" style={styles.cornerBottomRight}>
          <CornerGeometricMotif size={cornerSize} color={goldStroke} opacity={cornerOpacity} />
        </View>
      )}

      {/* Foreground Content */}
      <View style={[styles.contentContainer, contentContainerStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  contentContainer: {
    flex: 1,
    zIndex: 2,
  },
  latticeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  glowCenter: {
    position: 'absolute',
    top: '25%',
    left: '20%',
    right: '20%',
    height: 400,
    borderRadius: 200,
    zIndex: 0,
  },
  cornerTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
  },
  cornerTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    transform: [{ scaleX: -1 }],
    zIndex: 1,
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    transform: [{ scaleY: -1 }],
    zIndex: 1,
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    transform: [{ scaleX: -1 }, { scaleY: -1 }],
    zIndex: 1,
  },
});
