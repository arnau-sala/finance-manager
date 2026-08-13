import type { Meta, StoryObj } from "@storybook/react-vite";

import { FatalErrorFallback } from "../src/observability/FatalErrorFallback";

const meta = {
  title: "App/Error states",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const SomethingWentWrong: Story = {
  render: () => (
    <div className="storybook-mobile-frame">
      <FatalErrorFallback />
    </div>
  ),
};
