import { BarChart, LineChart } from "echarts/charts";
import {
  AriaComponent,
  GridComponent,
  MarkLineComponent,
  TooltipComponent
} from "echarts/components";
import { init, use } from "echarts/core";
import { SVGRenderer } from "echarts/renderers";

export type {
  EChartsCoreOption,
  EChartsType,
  SetOptionOpts
} from "echarts/core";

use([
  BarChart,
  LineChart,
  AriaComponent,
  GridComponent,
  MarkLineComponent,
  TooltipComponent,
  SVGRenderer
]);

export { init };
