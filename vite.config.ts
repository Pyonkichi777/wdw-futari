import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages では https://pyonkichi777.github.io/wdw-futari/ で配信される
export default defineConfig({
  base: "/wdw-futari/",
  plugins: [react()],
});
