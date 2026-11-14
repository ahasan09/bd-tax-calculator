import { createTheme, type MantineColorsTuple } from '@mantine/core';

// Bangladesh bottle green (#006a4e = shade 7), light → dark.
const bdgreen: MantineColorsTuple = [
  '#e8f6f1', '#d3ebe2', '#a6d6c4', '#77c0a4', '#4fad89',
  '#36a078', '#1f8a64', '#006a4e', '#005a42', '#004935'
];

// System fonts only — Bangla falls back to the device's own Bangla face
// (Kohinoor on Apple, Noto on Android, Nirmala on Windows), so no web-font
// request ever leaves the page.
const SYSTEM = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial';
const BANGLA = '"Kohinoor Bangla", "Noto Sans Bengali", "Nirmala UI", "Bangla Sangam MN", Vrinda';

export const theme = createTheme({
  colors: { bdgreen },
  primaryColor: 'bdgreen',
  primaryShade: { light: 7, dark: 5 },
  fontFamily: `${SYSTEM}, ${BANGLA}, sans-serif`,
  headings: { fontFamily: `${SYSTEM}, ${BANGLA}, sans-serif` },
  defaultRadius: 'md'
});
