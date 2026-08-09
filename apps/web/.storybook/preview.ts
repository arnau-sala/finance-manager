import type { Preview } from "@storybook/react-vite";

import "@fontsource/inter/latin-300.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-600.css";
import "../src/styles/tokens.css";
import "../src/styles/text-fields.css";
import "../src/styles/global.css";
import "../src/styles/buttons.css";
import "./preview.css";

const preview: Preview = {
  parameters: {
    controls: {
      expanded: true
    },
    backgrounds: {
      default: "App surface",
      values: [
        { name: "App surface", value: "#ffffff" },
        { name: "Muted surface", value: "#f5f7f7" }
      ]
    },
    layout: "fullscreen"
  }
};

export default preview;
