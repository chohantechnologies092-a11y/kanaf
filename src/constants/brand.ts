/** Sultan Restaurant brand palette and design tokens inspired by Baithak system. */
export const BRAND = {
  // Royal Sultan Primary Palette
  burgundy: '#52141C',
  burgundyDark: '#24050A',
  burgundyDeep: '#180306',
  burgundySoft: 'rgba(82, 20, 28, 0.08)',
  
  // Royal Sultan Gold Palette
  gold: '#D4AF37',
  goldLight: '#F3D179',
  goldDark: '#B8860B',
  goldMuted: '#C49A45',
  goldSoft: 'rgba(212, 175, 55, 0.12)',
  goldGlow: 'rgba(212, 175, 55, 0.35)',
  goldBorder: 'rgba(212, 175, 55, 0.28)',
  goldBorderLight: 'rgba(212, 175, 55, 0.45)',

  // Backgrounds & Surfaces
  cream: '#FAF6F0',
  creamDark: '#EEDFD3',
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceDark: '#120205',
  ink: '#1C1C1E',
  text: '#24050A',
  textMuted: '#6B4046',
  muted: '#8E8E93',
  border: '#E5E5EA',

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

  // Jewel-Toned Executive Card Gradients (from Baithak Home)
  cards: {
    maroon: {
      from: '#4D101A',
      to: '#24050A',
      border: 'rgba(212, 175, 55, 0.35)',
      accent: '#F3D179',
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

  // Liquid Glass Design Tokens (Glassmorphism + Royal Sultan Aesthetics)
  liquidGlass: {
    dark: {
      bg: 'rgba(32, 5, 9, 0.82)',
      bgDeep: 'rgba(20, 3, 6, 0.88)',
      bgWeb: 'linear-gradient(135deg, rgba(56, 10, 17, 0.82) 0%, rgba(32, 5, 9, 0.9) 100%)',
      border: 'rgba(212, 175, 55, 0.25)',
      borderLight: 'rgba(243, 209, 121, 0.45)',
      innerHighlight: 'rgba(255, 255, 255, 0.12)',
      shadow: '0 16px 40px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
      blur: 'blur(24px)',
    },
    light: {
      bg: 'rgba(255, 255, 255, 0.86)',
      bgWeb: 'linear-gradient(135deg, rgba(255, 255, 255, 0.94) 0%, rgba(250, 246, 240, 0.84) 100%)',
      border: 'rgba(212, 175, 55, 0.24)',
      innerHighlight: 'rgba(255, 255, 255, 0.95)',
      shadow: '0 10px 32px rgba(82, 20, 28, 0.07), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
      blur: 'blur(20px)',
    },
    gold: {
      bg: 'rgba(212, 175, 55, 0.14)',
      border: 'rgba(212, 175, 55, 0.38)',
      borderHover: 'rgba(243, 209, 121, 0.65)',
      glow: '0 0 24px rgba(212, 175, 55, 0.32)',
    },
    pill: {
      web: 'linear-gradient(135deg, #F3D179 0%, #D4AF37 55%, #B8860B 100%)',
      glow: '0 4px 18px rgba(212, 175, 55, 0.45)',
    },
  },
} as const;

