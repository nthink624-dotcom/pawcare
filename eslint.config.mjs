import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    ignores: ["petmanager-v3.jsx", "petmanager-landing.jsx", ".tmp/**", "captures/**", "android/**"],
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
