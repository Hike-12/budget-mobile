import { Platform } from 'react-native';

const Colors = {
  // Core (matches original palette)
  dark: '#000000',
  primary: '#5682B1',
  secondary: '#739EC9',
  accent: '#FFE8DB',
  red: '#EF4444',
  green: '#10B981',
  card: '#101010',

  // Subtle additions for polish
  cardElevated: '#161616',
  border: 'rgba(255,255,255,0.06)',
  borderLight: 'rgba(255,255,255,0.10)',
  textMuted: '#5C6370',
  warning: '#FBBF24',

  // Platform shadows
  shadow: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
    },
    android: {
      elevation: 4,
    },
  }),
};

export default Colors;