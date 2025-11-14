// Mock 数据结构
const channels = [
  {
    key: "stable",
    name: "Stable",
    environments: {
      staging: [
        {
          key: "s1",
          version: "1.0.3",
          status: "Running",
          time: "2025-11-11 14:30",
          operator: "Bob",
        },
        {
          key: "s2",
          version: "1.0.2",
          status: "Success",
          time: "2025-11-10 18:00",
          operator: "Alice",
        },
        {
          key: "s3",
          version: "1.0.1",
          status: "Failed",
          time: "2025-11-09 17:00",
          operator: "David",
        },
        {
          key: "s4",
          version: "1.0.0",
          status: "Success",
          time: "2025-11-08 15:00",
          operator: "Eve",
        },
      ],
      production: [
        {
          key: "p1",
          version: "1.0.2",
          status: "Success",
          time: "2025-11-11 15:00",
          operator: "Alice",
        },
        {
          key: "p2",
          version: "1.0.1",
          status: "Failed",
          time: "2025-11-10 18:30",
          operator: "Charlie",
        },
        {
          key: "p3",
          version: "1.0.0",
          status: "Success",
          time: "2025-11-09 09:20",
          operator: "Bob",
        },
        {
          key: "p4",
          version: "0.9.9",
          status: "Success",
          time: "2025-11-08 08:00",
          operator: "Frank",
        },
      ],
    },
  },
  {
    key: "hotfix",
    name: "Hot Fix",
    environments: {
      production: [
        {
          key: "h1",
          version: "1.0.5",
          status: "Success",
          time: "2025-11-12 09:00",
          operator: "Grace",
        },
        {
          key: "h2",
          version: "1.0.4",
          status: "Success",
          time: "2025-11-11 20:00",
          operator: "David",
        },
        {
          key: "h3",
          version: "1.0.3",
          status: "Failed",
          time: "2025-11-11 10:00",
          operator: "Eve",
        },
        {
          key: "h4",
          version: "1.0.2",
          status: "Success",
          time: "2025-11-10 15:00",
          operator: "Bob",
        },
      ],
    },
  },
  {
    key: "default",
    name: "Default",
    environments: {
      test: [
        {
          key: "t1",
          version: "2.0.1",
          status: "Success",
          time: "2025-11-12 08:00",
          operator: "Henry",
        },
        {
          key: "t2",
          version: "2.0.0",
          status: "Success",
          time: "2025-11-11 18:00",
          operator: "Ivy",
        },
        {
          key: "t3",
          version: "1.9.9",
          status: "Failed",
          time: "2025-11-10 17:00",
          operator: "Jack",
        },
        {
          key: "t4",
          version: "1.9.8",
          status: "Success",
          time: "2025-11-09 15:00",
          operator: "Kate",
        },
      ],
      aut: [
        {
          key: "a1",
          version: "2.0.1",
          status: "Running",
          time: "2025-11-12 08:30",
          operator: "Leo",
        },
        {
          key: "a2",
          version: "2.0.0",
          status: "Success",
          time: "2025-11-11 19:00",
          operator: "Mona",
        },
        {
          key: "a3",
          version: "1.9.9",
          status: "Success",
          time: "2025-11-10 16:00",
          operator: "Nina",
        },
        {
          key: "a4",
          version: "1.9.8",
          status: "Failed",
          time: "2025-11-09 14:00",
          operator: "Oscar",
        },
      ],
      prd: [
        {
          key: "p1",
          version: "sdguaigvdsuhcbjcfvaiuhgsflvjbdfiureufygdhbsjdideurghfjdskeiursy",
          status: "Success",
          time: "2025-11-11 20:00",
          operator: "Paul",
        },
        {
          key: "p2",
          version: "1.9.9",
          status: "Success",
          time: "2025-11-10 18:00",
          operator: "Quinn",
        },
        {
          key: "p3",
          version: "1.9.8",
          status: "Failed",
          time: "2025-11-09 16:00",
          operator: "Rose",
        },
        {
          key: "p4",
          version: "1.9.7",
          status: "Success",
          time: "2025-11-08 13:00",
          operator: "Steve",
        },
      ],
      prd1: [
        {
          key: "p1",
          version: "sdguaigvdsuhcbjcfvaiuhgsflvjbdfiureufygdhbsjdideurghfjdskeiursy",
          status: "Success",
          time: "2025-11-11 20:00",
          operator: "Paul",
        },
        {
          key: "p2",
          version: "1.9.9",
          status: "Success",
          time: "2025-11-10 18:00",
          operator: "Quinn",
        },
        {
          key: "p3",
          version: "1.9.8",
          status: "Failed",
          time: "2025-11-09 16:00",
          operator: "Rose",
        },
        {
          key: "p4",
          version: "1.9.7",
          status: "Success",
          time: "2025-11-08 13:00",
          operator: "Steve",
        },
      ]
    },
  },
];

export default channels;