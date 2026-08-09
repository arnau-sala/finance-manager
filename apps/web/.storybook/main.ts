import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(ts|tsx|mdx)"],
  framework: {
    name: "@storybook/react-vite",
    options: {}
  },
  staticDirs: ["../public"],
  typescript: {
    reactDocgen: "react-docgen-typescript"
  }
};

export default config;
