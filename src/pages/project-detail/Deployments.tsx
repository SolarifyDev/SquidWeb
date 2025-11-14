import React, { useRef, useEffect } from "react";
import { Card, Typography, Tag, List, Space, Divider } from "antd";
import channels from "./mock-detail-data";
import { CheckCircleFilled } from "@ant-design/icons";

const { Title, Text } = Typography;

type Deployment = {
  key: string;
  version: string;
  status: string;
  time: string;
  operator: string;
};

const statusColor = (status: string) => {
  if (status === "Success") return "green";
  if (status === "Failed") return "red";
  if (status === "Running") return "blue";
  return "default";
};

const envColor = (envKey: string) => {
  if (envKey.toLowerCase().includes("prod") || envKey === "production" || envKey === "prd") return "text-red-600";
  if (envKey.toLowerCase().includes("test") || envKey === "staging" || envKey === "aut") return "text-blue-600";
  return "text-gray-700";
};

const envDisplayName = (envKey: string) => {
  if (envKey === "staging") return "测试环境";
  if (envKey === "production") return "正式环境";
  if (envKey === "test") return "测试环境";
  if (envKey === "aut") return "自动化环境";
  if (envKey === "prd") return "生产环境";
  return envKey;
};

const Deployments: React.FC = () => {
  // refs: channelIdx -> envIdx -> itemIdx -> ref
  const itemRefs = useRef<Array<Array<Array<HTMLDivElement | null>>>>([]);

  useEffect(() => {
    // 对每个 channel
    itemRefs.current.forEach((envRefs) => {
      // 取该 channel 下所有环境的 item 数量最大值
      const maxItems = Math.max(...envRefs.map((arr) => arr.length));
      // 对每一行
      for (let i = 0; i < maxItems; i++) {
        // 取该行所有环境的高度
        const heights = envRefs.map((envArr) => envArr[i]?.offsetHeight || 0);
        const maxHeight = Math.max(...heights);
        // 设置所有环境该行的高度为 maxHeight
        envRefs.forEach((envArr) => {
          if (envArr[i]) {
            envArr[i]!.style.height = maxHeight + "px";
          }
        });
      }
    });
  });

  return (
    <div className="p-0">
      <div className="mb-6">
        <Title level={3} className="mb-1 font-bold text-gray-900">部署分布</Title>
        <Text type="secondary" className="text-base">
          按 Channel 分组展示各环境（支持任意数量）最近 4 个部署包。超过3个环境时可横向滚动。不同环境同一行高度自动对齐。
        </Text>
      </div>
      <div className="flex flex-col gap-8">
        {channels.map((channel, channelIdx) => {
          const envEntries = Object.entries(channel.environments);
          const envCount = envEntries.length;
          const isScroll = envCount > 4;
          // 初始化 refs
          if (!itemRefs.current[channelIdx]) itemRefs.current[channelIdx] = [];
          return (
            <div
              key={channel.key}
              className="rounded-xl bg-white border border-gray-100 shadow-sm px-0 py-0"
            >
              <div className="flex items-center gap-2 px-6 pt-6 pb-2">
                <span className="font-bold text-lg text-gray-900">{channel.name}</span>
                <Tag color="geekblue" className="ml-2">{channel.key}</Tag>
              </div>
              <Divider className="my-0" />
              <div className="overflow-x-auto">
                <div
                  className={`flex flex-row gap-0 whitespace-nowrap`}
                  style={isScroll ? { minWidth: 4 * 320 } : {}}
                >
                  {envEntries.map(([envKey, records], envIdx) => {
                    let envClass = "";
                    if (envCount === 1) {
                      envClass = "w-full";
                    } else if (envCount === 2) {
                      envClass = "w-1/2";
                    } else if (envCount === 3) {
                      envClass = "w-1/3";
                    } else {
                      envClass = "min-w-[33.3333%] max-w-[33.3333%] flex-shrink-0";
                    }
                    // 初始化 refs
                    if (!itemRefs.current[channelIdx][envIdx]) itemRefs.current[channelIdx][envIdx] = [];
                    return (
                      <div
                        key={envKey}
                        className={`${envClass} px-6 py-4 ${envIdx !== 0 ? "md:border-l" : ""}`}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <span className={`font-semibold text-base ${envColor(envKey)}`}>
                            {envDisplayName(envKey)}
                          </span>
                        </div>
                        <List
                          itemLayout="horizontal"
                          dataSource={records}
                          renderItem={(item: Deployment, idx) => (
                            <List.Item
                              ref={el => itemRefs.current[channelIdx][envIdx][idx] = el}
                              className={`rounded-lg px-3 py-2 mb-2 border border-transparent border-b border-gray-200 last:border-b-0 transition-all duration-150`}
                              actions={
                                idx !== 0
                                  ? [
                                      <button
                                        key="deploy"
                                        className="ml-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                                      >
                                        Deploy
                                      </button>,
                                    ]
                                  : undefined
                              }
                            >
                              <List.Item.Meta
                                title={
                                  <div className={`flex items-center gap-2 w-full ${idx === 0 ? "text-opacity-100" : idx === 1 ? "text-opacity-60" : idx === 2 ? "text-opacity-50" : "text-opacity-40"} text-black`}>
                                    <Tag color={statusColor(item.status)} className="px-3 py-1 rounded-full text-base font-semibold" title={item.status}>
                                      {item.status}
                                    </Tag>
                                    <span
                                      className="font-medium text-base break-all whitespace-normal block"
                                      title={item.version}
                                    >
                                      v{item.version}
                                    </span>
                                  </div>
                                }
                                  description={
                                    <span className={`text-gray-500 text-sm truncate block max-w-[180px] ${idx === 0 ? "text-opacity-100" : idx === 1 ? "text-opacity-80" : idx === 2 ? "text-opacity-60" : "text-opacity-40"}`} title={`${item.time} by ${item.operator}`}>
                                      {item.time} by <span className="truncate inline-block max-w-[80px] align-bottom" title={item.operator}>{item.operator}</span>
                                    </span>
                                  }
                              />
                            </List.Item>
                          )}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Divider className="my-8" />
      {/* 可扩展：下方为历史部署表格/列表等 */}
    </div>
  );
};

export default Deployments;
