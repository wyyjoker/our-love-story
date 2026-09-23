/** Shared UI theme tokens — Cocos converts via Color.fromHEX / CocosTheme. */
export const Theme = {
  background: '#FFF8F3',
  surface: '#FFFFFF',
  primary: '#EFA7B5',
  secondary: '#B7C9B1',
  accent: '#C8B6E2',
  textPrimary: '#493F3F',
  textSecondary: '#857979',
  border: '#F0E4DC',
  shadow: 'rgba(73, 63, 63, 0.08)',
  danger: '#E07A7A',
  ok: '#8FBF9F',
  chains: {
    coffee: '#C4A484',
    flower: '#E8A0B5',
    dessert: '#E8C07A',
    gift: '#B8A0D8',
  },
} as const;

export type ThemeTokens = typeof Theme;
