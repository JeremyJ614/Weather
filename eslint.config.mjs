import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated Census place list.
    "src/lib/geo/places.data.ts",
    // Static design labs: plain browser scripts published as artifacts.
    "design-lab/**",
    "public/vendor/**",
  ]),
]);

export default eslintConfig;
