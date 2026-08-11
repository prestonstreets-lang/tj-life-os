export const THEME_PACKS = {
  'neon-nexus': {
    name: 'Neon Nexus', detail: 'Cyan, violet and magenta command energy', icon: '✦',
    colors: { bg: '#050816', bg2: '#0a1023', panel: '16,25,52', accent: '#63e6ff', accent2: '#927cff', accent3: '#ff6fcf', text: '#f7f9ff', muted: '#98a6c7', glow: '99,230,255' }
  },
  'emerald-vault': {
    name: 'Emerald Vault', detail: 'Deep green glass with secured gold signals', icon: '◈',
    colors: { bg: '#03110d', bg2: '#071d17', panel: '10,39,31', accent: '#5ef2a5', accent2: '#ffd166', accent3: '#2dd4bf', text: '#f2fff9', muted: '#91b8a7', glow: '94,242,165' }
  },
  'solar-command': {
    name: 'Solar Command', detail: 'Molten amber, hot coral and plasma yellow', icon: '☀',
    colors: { bg: '#160905', bg2: '#2a1208', panel: '55,24,13', accent: '#ffb347', accent2: '#ff5d7d', accent3: '#ffe66d', text: '#fff9f1', muted: '#c7a28f', glow: '255,157,92' }
  },
  'ocean-reactor': {
    name: 'Ocean Reactor', detail: 'Midnight blue, aqua and bioluminescent teal', icon: '◌',
    colors: { bg: '#03101a', bg2: '#071f31', panel: '9,35,55', accent: '#42e8e0', accent2: '#4f8cff', accent3: '#7cf7c8', text: '#f3fbff', muted: '#8eafc3', glow: '66,232,224' }
  },
  'royal-spectrum': {
    name: 'Royal Spectrum', detail: 'Indigo, ultraviolet and luminous rose', icon: '◇',
    colors: { bg: '#0b0618', bg2: '#1b0c31', panel: '37,20,66', accent: '#b482ff', accent2: '#ff6fcf', accent3: '#63b8ff', text: '#fff7ff', muted: '#b09bc6', glow: '180,130,255' }
  },
  'stealth-ops': {
    name: 'Stealth Ops', detail: 'Graphite instruments with precise ice signals', icon: '⬡',
    colors: { bg: '#050709', bg2: '#11161d', panel: '22,28,37', accent: '#c6f4ff', accent2: '#7c91ad', accent3: '#76e6b5', text: '#f5f7fa', muted: '#8c98a8', glow: '198,244,255' }
  }
};

export const DEFAULT_THEME_SETTINGS = {
  pack: 'neon-nexus', customHue: 190, customSaturation: 88, customBrightness: 58,
  glow: 'cinematic', oled: false, unifySystems: false, autoTime: false
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

export function normalizeThemeSettings(value = {}) {
  const next = { ...DEFAULT_THEME_SETTINGS, ...value };
  if (!(next.pack in THEME_PACKS) && next.pack !== 'custom-spectrum') next.pack = DEFAULT_THEME_SETTINGS.pack;
  next.customHue = clamp(next.customHue, 0, 360);
  next.customSaturation = clamp(next.customSaturation, 20, 100);
  next.customBrightness = clamp(next.customBrightness, 30, 75);
  if (!['off', 'low', 'cinematic'].includes(next.glow)) next.glow = 'cinematic';
  next.oled = Boolean(next.oled);
  next.unifySystems = Boolean(next.unifySystems);
  next.autoTime = Boolean(next.autoTime);
  return next;
}

export function packForTime(hour = new Date().getHours()) {
  if (hour >= 6 && hour < 12) return 'solar-command';
  if (hour >= 12 && hour < 18) return 'ocean-reactor';
  if (hour >= 18 && hour < 23) return 'royal-spectrum';
  return 'stealth-ops';
}

function customColors(settings) {
  const h = settings.customHue;
  const s = settings.customSaturation;
  const l = settings.customBrightness;
  return {
    bg: `hsl(${h} ${Math.min(s, 70)}% 5%)`, bg2: `hsl(${h} ${Math.min(s, 74)}% 11%)`,
    panel: `${Math.round(20 + h / 18)},${Math.round(24 + s / 8)},${Math.round(45 + l / 7)}`,
    accent: `hsl(${h} ${s}% ${l}%)`, accent2: `hsl(${(h + 72) % 360} ${s}% ${Math.min(72, l + 5)}%)`,
    accent3: `hsl(${(h + 188) % 360} ${s}% ${Math.min(72, l + 8)}%)`, text: '#f8fbff', muted: '#9ba9c2',
    glow: `${Math.round(90 + h / 5)},${Math.round(150 + s)},${Math.round(145 + l)}`
  };
}

export function resolveTheme(value = {}, hour = new Date().getHours()) {
  const settings = normalizeThemeSettings(value);
  const key = settings.autoTime ? packForTime(hour) : settings.pack;
  if (key === 'custom-spectrum') return { key, name: 'Custom Spectrum', detail: 'Your calibrated full-spectrum command palette', icon: '◎', colors: customColors(settings), settings };
  return { key, ...THEME_PACKS[key], settings };
}
