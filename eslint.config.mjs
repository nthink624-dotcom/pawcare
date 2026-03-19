import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    ignores: ["pawcare-v3.jsx", "pawcare-landing.jsx"],
  },
];

export default config;
