import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { getExposesPaths } from "./vite-plugins/index";

// https://vite.dev/config/
export default defineConfig(() => {
  const paths = getExposesPaths(["components"]);

  console.log(paths);
  return {
    plugins: [vue()],
  };
});
