import React from 'react';
import ReactDOM from 'react-dom/client';
import AutoCharts from './pages/index'
import { getChartType } from './pages/helpers/index';

// Name of our class doesn't matter
  class AutoChartsElement extends HTMLElement {
    connectedCallback() {
      const root = ReactDOM.createRoot(this);
      // 传参
      const chartDataStr = this.getAttribute('chartData');
      const chartData = chartDataStr ? JSON.parse(chartDataStr) : {};
      root.render(
        <div>
            <AutoCharts data={chartData?.data} chartType={getChartType(chartData?.type)}></AutoCharts>
        </div>
      );
    }
}
  
  const tagName = "charts-component";
  
  if (!window.customElements.get(tagName)) {
    // prevent rerunning on hot module reloads
    // register to be rendered in place of every <evil-plan> tag
    window.customElements.define(tagName, AutoChartsElement);
  }
