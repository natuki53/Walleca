import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const config = [
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'tailwind.config.js',
      'postcss.config.js',
      'next.config.js',
    ],
  },
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      'react-hooks/incompatible-library': 'off',
    },
  },
];

export default config;
