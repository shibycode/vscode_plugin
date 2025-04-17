// @ts-nocheck
import { DownloadOutlined } from '@ant-design/icons';
import { Advice, Advisor, Datum } from '@antv/ava';
import { Chart, ChartRef } from '@berryv/g2-react/es/Chart';
import { Button, Col, Empty, Row, Select, Space, Tooltip, Spin } from 'antd';
import { compact, concat, uniq } from 'lodash';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { downloadImage } from './helpers/downloadChartImage';
import { customizeAdvisor, getVisAdvices } from './advisor/pipeline';
import { defaultAdvicesFilter } from './advisor/utils';
import { customCharts } from './charts';
import { processNilData, sortData, chartTypeToName } from './charts/util';
import { AutoChartProps, ChartType, CustomAdvisorConfig, CustomChart, Specification } from './types';

const { Option } = Select;

function AutoCharts(props: AutoChartProps) {
  const { data: originalData, chartType, scopeOfCharts, ruleConfig } = props;
  // // 处理空值数据 (为'-'的数据)
  // const data = processNilData(originalData) as Datum[];
  // 用 useMemo 缓存处理后的 data
  const data = useMemo(() => {
    console.log('重新计算 processed data'); // 调试日志
    return processNilData(originalData) as Datum[];
  }, [originalData]); // 只有当 originalData 引用变化时才重新计算


  // const [advisor, setAdvisor] = useState<Advisor>();
// 先缓存配置对象
const advisorConfig = useMemo(() => {
  console.log('重新生成 advisorConfig');
  return {
    charts: customCharts, // 假设 customCharts 是静态的
    scopeOfCharts: {
      exclude: ['area_chart', 'stacked_area_chart', 'percent_stacked_area_chart'],
    },
    ruleConfig, // 如果 ruleConfig 是 props，需要确保其稳定性
  };
}, [ruleConfig]); // 只有 ruleConfig 变化时才重新生成配置

// 再缓存 advisor 实例
const advisor = useMemo(() => {
  console.log('重新初始化 advisor');
  return customizeAdvisor(advisorConfig);
}, [advisorConfig]); // 依赖项必须是稳定的对象

  const [advices, setAdvices] = useState<Advice[]>([]);
  const [renderChartType, setRenderChartType] = useState<ChartType>();
  const chartRef = useRef<ChartRef>();
  const mountedRef = useRef(false);

  useEffect(() => {
    const input_charts: CustomChart[] = customCharts;
    const advisorConfig: CustomAdvisorConfig = {
      charts: input_charts,
      scopeOfCharts: {
        exclude: ['area_chart', 'stacked_area_chart', 'percent_stacked_area_chart'],
      },
      ruleConfig,
    };
    // setAdvisor(customizeAdvisor(advisorConfig));
  }, [ruleConfig, scopeOfCharts]);

  /** 将 AVA 得到的图表推荐结果和模型的合并 */
  const getMergedAdvices = useCallback((avaAdvices: Advice[]) => {
    if (!advisor) return [];
    const filteredAdvices = defaultAdvicesFilter({
      advices: avaAdvices
    });
    const allChartTypes = uniq(
      compact(
        concat(
          chartType,
          avaAdvices.map(item => item.type),
        ),
      ),
    );
    return allChartTypes
      .map(chartTypeItem => {
        const avaAdvice = filteredAdvices.find(item => item.type === chartTypeItem);
        if (avaAdvice) {
          return avaAdvice;
        }
        const dataAnalyzerOutput = (advisor as any).dataAnalyzer.execute({ data });
        if ('data' in dataAnalyzerOutput) {
          const specGeneratorOutput = (advisor as any).specGenerator.execute({
            data: dataAnalyzerOutput.data,
            dataProps: dataAnalyzerOutput.dataProps,
            chartTypeRecommendations: [{ chartType: chartTypeItem, score: 1 }],
          });
          if ('advices' in specGeneratorOutput) return specGeneratorOutput.advices?.[0];
        }
        return undefined;
      })
      .filter((advice): advice is Advice => advice?.spec !== undefined);
  }, [advisor, chartType, data]);

  useEffect(() => {
    if (data && advisor) {
      const avaAdvices = getVisAdvices({
        data,
        myChartAdvisor: advisor,
      });
      const allAdvices = getMergedAdvices(avaAdvices);
      setAdvices(allAdvices);
      setRenderChartType(allAdvices[0]?.type as ChartType);

    }
  }, [data, advisor, getMergedAdvices]);

   // 正确写法
  const handleChange = (newType: ChartType) => {
    setRenderChartType(newType as ChartType);
    console.log('New chart type:', newType);
  };

  useEffect(() => {
    console.log('advices 变化:', advices);
  }, [advices]);
  
  useEffect(() => {
    console.log('data 变化:', data.slice(0, 3)); // 打印部分数据
  }, [data]);

  const visComponent = useMemo(() => {
    if (advices?.length > 0) {
      const chartTypeInput = renderChartType ?? advices[0].type;
      const spec: Specification = advices.find((item: Advice) => item.type === chartTypeInput)?.spec;
      if (spec) {
        if (spec.data && ['line_chart', 'step_line_chart'].includes(chartTypeInput as string)) {
          const dataAnalyzerOutput = (advisor as any).dataAnalyzer.execute({ data });
          if (dataAnalyzerOutput && 'dataProps' in dataAnalyzerOutput) {
            const dateField = dataAnalyzerOutput.dataProps?.find((field: any) => field.recommendation === 'date');
            if (dateField) {
              spec.data = sortData({
                data: spec.data,
                xField: dateField,
                chartType: chartTypeInput as string,
              });
            }
          }
        }
        if (chartTypeInput === 'pie_chart' && spec?.encode?.color) {
          spec.tooltip = { title: { field: spec.encode.color } };
        }
        return (
            <Chart
              key={chartTypeInput}
              options={{
                ...spec,
                autoFit: false,
                width: 800,
                height: 300,
              }}
              ref={chartRef}
            />
        );
      }
    }
    return null;
  }, [advices, renderChartType, advisor, data]);

  if (renderChartType) {
    return (
      <div>
        <Row justify='space-between' className='mb-2'>
          <Col>
            <Space>
              <span>自动推荐</span>
              <Select
                className='w-52'
                value={renderChartType}
                placeholder={'Chart Switcher'}
                // onChange={value => setRenderChartType(value)}
                onChange={handleChange}
                size={'small'}
              >
                {advices?.map(item => {
                  const name = chartTypeToName(item.type || '');
                  return (
                    <Option key={item.type} value={item.type}>
                      <Tooltip title={name} placement={'right'}>
                        <div>{name}</div>
                      </Tooltip>
                    </Option>
                  );
                })}
              </Select>
            </Space>
          </Col>
          <Col>
            <Tooltip title='下载'>
              <Button
                onClick={() => downloadImage(chartRef.current, chartTypeToName(renderChartType || ''))}
                icon={<DownloadOutlined />}
                type='text'
              />
            </Tooltip>
          </Col>
        </Row>
        <div className='w-full mx-10'>
          {visComponent}
        </div>
      </div>
    );
  }

  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={'暂无合适的可视化视图'} />;
}

export default AutoCharts;

