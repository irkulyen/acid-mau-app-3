export const themeColors: {
  primary: { light: string; dark: string };
  background: { light: string; dark: string };
  surface: { light: string; dark: string };
  foreground: { light: string; dark: string };
  muted: { light: string; dark: string };
  border: { light: string; dark: string };
  success: { light: string; dark: string };
  warning: { light: string; dark: string };
  error: { light: string; dark: string };
  primaryTable: { light: string; dark: string };
  secondaryNeon: { light: string; dark: string };
  surface1: { light: string; dark: string };
  surface2: { light: string; dark: string };
  textMain: { light: string; dark: string };
  textMuted: { light: string; dark: string };
  textInverse: { light: string; dark: string };
  stateSuccess: { light: string; dark: string };
  stateWarning: { light: string; dark: string };
  stateDanger: { light: string; dark: string };
};

declare const themeConfig: {
  themeColors: typeof themeColors;
};

export default themeConfig;
