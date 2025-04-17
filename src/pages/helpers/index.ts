import { ChartId } from '@antv/ava';
import { CustomChartsType } from '../charts';

// 定义后端图表类型
export type BackEndChartType =
  | 'response_line_chart'
  | 'response_bar_chart'
  | 'response_pie_chart'
  | 'response_scatter_chart'
  | 'response_area_chart'
  | 'response_heatmap_chart'
  | 'response_table';

// 定义图表类型
type ChartType = ChartId | CustomChartsType;

// 根据后端图表类型获取图表类型
// 根据后端图表类型返回前端图表类型
export const getChartType = (backendChartType: String): ChartType[] => {
  // 如果后端图表类型为response_line_chart，则返回multi_line_chart和multi_measure_line_chart
  if (backendChartType === 'response_line_chart') {
    return ['multi_line_chart', 'multi_measure_line_chart'];
  }
  // 如果后端图表类型为response_bar_chart，则返回multi_measure_column_chart
  if (backendChartType === 'response_bar_chart') {
    return ['multi_measure_column_chart'];
  }
  // 如果后端图表类型为response_pie_chart，则返回pie_chart
  if (backendChartType === 'response_pie_chart') {
    return ['pie_chart'];
  }
  // 如果后端图表类型为response_scatter_chart，则返回scatter_plot
  if (backendChartType === 'response_scatter_chart') {
    return ['scatter_plot'];
  }
  // 如果后端图表类型为response_area_chart，则返回area_chart
  if (backendChartType === 'response_area_chart') {
    return ['area_chart'];
  }
  // 如果后端图表类型为response_heatmap_chart，则返回heatmap
  if (backendChartType === 'response_heatmap_chart') {
    return ['heatmap'];
  }
  // 否则返回空数组
  return [];
};
