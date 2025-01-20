// @ts-check
import starlight from "@astrojs/starlight";
import tailwind from "@astrojs/tailwind";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  site: "https://gensx.dev",
  integrations: [
    tailwind(),
    starlight({
      title: "",
      description: "Create LLM workflows from components",
      social: {
        github: "https://github.com/cortexclick/gensx",
      },
      logo: {
        src: "./public/logo.svg",
      },
      components: {
        ThemeSelect: "./src/components/ThemeSelect.astro",
        ThemeProvider: "./src/components/ThemeProvider.astro",
      },
      expressiveCode: {
        themes: ["light-plus", "dark-plus"],
        useStarlightDarkModeSwitch: false,
      },
      editLink: {
        baseUrl: "https://github.com/cortexclick/gensx/edit/main/docs/",
      },
      customCss: ["./src/tailwind.css"],
      sidebar: [
        {
          label: "Overview",
          link: "/overview",
        },
        {
          label: "Basic Concepts",
          link: "/basic-concepts",
        },
        {
          label: "Quickstart",
          link: "/quickstart",
        },
        {
          label: "Why JSX?",
          link: "/why-jsx",
        },

        // {
        //   label: "Concepts",
        //   autogenerate: { directory: "concepts" },
        // },
        // {
        //   label: "LLM patterns",
        //   autogenerate: { directory: "patterns" },
        // },
        {
          label: "Examples",
          autogenerate: { directory: "examples" },
        },
        // {
        //   label: "Component reference",
        //   autogenerate: { directory: "component-reference" },
        // },
      ],
    }),
    tailwind({
      applyBaseStyles: false,
    }),
  ],
  // adapter: cloudflare({
  //   imageService: "compile",
  // }),
  vite: {
    ssr: {
      external: ["node:buffer", "node:path", "node:url"],
    },
  },
});
