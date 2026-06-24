import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Резолвим алиас "@/..." (как в tsconfig paths), чтобы unit-тесты могли импортировать
// значения из модулей, а не только type-only. Окружение по умолчанию — node.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
  },
});
