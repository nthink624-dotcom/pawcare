import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    ignores: [
      "petmanager-v3.jsx",
      "petmanager-landing.jsx",
      ".tmp/**",
      "tmp/**",
      ".local-secrets/**",
      "captures/**",
      "evidence/**",
      "output/**",
      ".codex/**",
      "test-results/**",
      "android/**",
      "backend/mastra-marketing-poc/.mastra/**",
    ],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    rules: {
      "@next/next/no-img-element": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
];

export default config;
