// Design tokens — import this anywhere in tui/ that needs colors or symbols.
// Nothing outside tui/ should ever import theme.ts.

export const theme = {
  colors: {
    primary:   '#7C3AED', // violet — brand color
    accent:    '#A78BFA', // light violet
    dim:       '#52525B', // zinc-600
    muted:     '#3F3F46', // zinc-700
    border:    '#27272A', // zinc-800
    text:      '#FAFAFA', // almost white
    textDim:   '#A1A1AA', // zinc-400
    success:   '#34D399', // emerald
    error:     '#F87171', // red
    warning:   '#FBBF24', // amber
    user:      '#60A5FA', // blue-400
    assistant: '#A78BFA', // violet-400
  },
  symbols: {
    prompt:    '❯',
    user:      '○',
    assistant: '◆',
    thinking:  '◌',
    success:   '✓',
    error:     '✗',
    separator: '─',
  },
} as const;
