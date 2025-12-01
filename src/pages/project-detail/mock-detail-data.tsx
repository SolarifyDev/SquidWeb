// Mock 数据结构 - 模拟 Deployments 页面数据
export interface DeploymentItem {
  key: string;
  version: string;
  status: "Success" | "Running" | "Failed" | "Pending";
  time: string;
  operator: string;
}

export interface ChannelData {
  key: string;
  name: string;
  environments: {
    [envKey: string]: DeploymentItem[];
  };
  // 每个环境当前部署的版本
  currentDeployed: {
    [envKey: string]: string;
  };
}

// 模拟数据
const channels: ChannelData[] = [
  {
    key: "default",
    name: "Default",
    currentDeployed: {
      test: "6.0.5-mixture-v6.1-3733",
      prd: "6.0.4",
    },
    environments: {
      test: [
        {
          key: "t1",
          version: "6.0.5-mixture-v6.1-3733",
          status: "Pending",
          time: "Dec 1, 2025 4:44 PM",
          operator: "Henry",
        },
        {
          key: "t2",
          version: "6.0.5-mixture-v6.1-3732",
          status: "Pending",
          time: "Dec 1, 2025 4:00 PM",
          operator: "Ivy",
        },
        {
          key: "t3",
          version: "6.0.5-mixture-v6.1-3723",
          status: "Success",
          time: "Dec 2025 8:41 PM",
          operator: "Jack",
        },
        {
          key: "t4",
          version: "6.0.4",
          status: "Success",
          time: "Nov 27, 2025 4:18 PM",
          operator: "Kate",
        },
      ],
      prd: [
        {
          key: "p1",
          version: "6.0.4",
          status: "Success",
          time: "Nov 27, 2025 4:18 PM",
          operator: "Paul",
        },
      ],
      uat: [
        {
          key: "u1",
          version: "6.0.4",
          status: "Success",
          time: "Nov 27, 2025 4:18 PM",
          operator: "Paul",
        },
      ],
    },
  },
  {
    key: "hotfix",
    name: "Hotfix",
    currentDeployed: {
      prd: "6.0.4-hot-fix-restaurant-field-length.1-21",
    },
    environments: {
      prd: [
        {
          key: "h1",
          version: "6.0.4-hot-fix-restaurant-field-length.1-21",
          status: "Success",
          time: "Nov 22, 2025 5:00 PM",
          operator: "Grace",
        },
        {
          key: "h2",
          version: "6.0.3-hot-fix-ome-project-listid.1-1",
          status: "Success",
          time: "Nov 11, 2025 4:30 PM",
          operator: "David",
        },
        {
          key: "h3",
          version: "6.0.2-hot-fix-ome-role.1-1",
          status: "Success",
          time: "Nov 10, 2025 3:00 PM",
          operator: "Eve",
        },
      ],
    },
  },
];

export default channels;