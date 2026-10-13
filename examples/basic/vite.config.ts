import flaredrive from "flaredrive/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [flaredrive({ app: "src/server.tsx" })],
});
