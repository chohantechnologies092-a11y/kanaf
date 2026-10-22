/** Kanaf Cafe & Bakery brand palette and design tokens aligned with official logo. */
export const BRAND = {
  // Kanaf Cafe & Bakery Primary Palette (#440112 Wine & #FFE0CB Warm Cream)
  burgundy: '#440112',
  burgundyDark: '#28010B',
  burgundyDeep: '#180006',
  burgundySoft: 'rgba(68, 1, 18, 0.08)',
  
  // Warm Cafe Wheat & Golden Caramel Palette
  gold: '#D89F67',
  goldLight: '#F3D179',
  goldDark: '#B57C42',
  goldMuted: '#C49A45',
  goldSoft: 'rgba(216, 159, 103, 0.14)',
  goldGlow: 'rgba(216, 159, 103, 0.35)',
  goldBorder: 'rgba(216, 159, 103, 0.28)',
  goldBorderLight: 'rgba(216, 159, 103, 0.45)',

  // Backgrounds & Warm Bakery Cream Surfaces
  cream: '#FFE0CB',
  creamDark: '#F0CCA8',
  bg: '#FDF9F5',
  surface: '#FFFFFF',
  surfaceDark: '#190107',
  ink: '#1C1C1E',
  text: '#28010B',
  textMuted: '#6B3840',
  muted: '#8E8E93',
  border: '#E8D5C8',

  // Semantic Status Colors
  success: '#10B981',
  successDark: '#047857',
  successSoft: '#ECFDF5',
  warn: '#F59E0B',
  warnDark: '#B45309',
  warnSoft: '#FFFBEB',
  danger: '#EF4444',
  dangerDark: '#B91C1C',
  dangerSoft: '#FEF2F2',
  info: '#0284C7',
  infoSoft: '#F0F9FF',
  purple: '#8B5CF6',
  purpleSoft: '#F5F3FF',

  // Jewel-Toned Executive Card Gradients
  cards: {
    maroon: {
      from: '#54061A',
      to: '#28010B',
      border: 'rgba(255, 224, 203, 0.35)',
      accent: '#FFE0CB',
    },
    amberDark: {
      from: '#2E1A0D',
      to: '#170B04',
      border: 'rgba(243, 209, 121, 0.35)',
      accent: '#F3D179',
    },
    tealDark: {
      from: '#0E3324',
      to: '#061912',
      border: 'rgba(16, 185, 129, 0.35)',
      accent: '#69F0AE',
    },
    sapphireDark: {
      from: '#12213D',
      to: '#091120',
      border: 'rgba(14, 165, 233, 0.35)',
      accent: '#82B1FF',
    },
    amethystDark: {
      from: '#261738',
      to: '#12091C',
      border: 'rgba(168, 85, 247, 0.35)',
      accent: '#E1BEE7',
    },
    rubyDark: {
      from: '#3D1016',
      to: '#1D0508',
      border: 'rgba(239, 68, 68, 0.35)',
      accent: '#FF8A80',
    },
  },
  cardBg: '#FFFFFF',

  // Liquid Glass Design Tokens (Glassmorphism + Kanaf Luxury Aesthetics)
  liquidGlass: {
    dark: {
      bg: 'rgba(68, 1, 18, 0.86)',
      bgDeep: 'rgba(40, 1, 11, 0.92)',
      bgWeb: 'linear-gradient(135deg, rgba(84, 6, 26, 0.86) 0%, rgba(40, 1, 11, 0.92) 100%)',
      border: 'rgba(255, 224, 203, 0.22)',
      borderLight: 'rgba(255, 224, 203, 0.38)',
      innerHighlight: 'rgba(255, 224, 203, 0.12)',
      shadow: '0 16px 40px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 224, 203, 0.12)',
      blur: 'blur(24px)',
    },
    light: {
      bg: 'rgba(255, 255, 255, 0.88)',
      bgWeb: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(253, 249, 245, 0.85) 100%)',
      border: 'rgba(216, 159, 103, 0.24)',
      innerHighlight: 'rgba(255, 255, 255, 0.95)',
      shadow: '0 10px 32px rgba(68, 1, 18, 0.07), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
      blur: 'blur(20px)',
    },
    gold: {
      bg: 'rgba(216, 159, 103, 0.14)',
      border: 'rgba(216, 159, 103, 0.38)',
      borderHover: 'rgba(243, 209, 121, 0.65)',
      glow: '0 0 24px rgba(216, 159, 103, 0.32)',
    },
    pill: {
      web: 'linear-gradient(135deg, #FFE0CB 0%, #D89F67 55%, #B57C42 100%)',
      glow: '0 4px 18px rgba(216, 159, 103, 0.45)',
    },
  },
} as const;

