import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    ignores: ["petmanager-v3.jsx", "petmanager-landing.jsx", ".tmp/**", "captures/**"],
  },
];

export default config;
