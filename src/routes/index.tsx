import Project from "pages/project";
import NotFound from "pages/notfound";
import Tasks from "pages/tasks";
import VariableSets from "pages/variablesets";
import ProjectDetail from "pages/project-detail";
import Deployments from "pages/project-detail/Deployments";
import { redirect } from "react-router-dom";

const routes = [
  {
    path: "project",
    name: "Deploy",
    meta: {
      icon: "🏠",
      showInNav: true,
    },
    children: [
      {
        path: "variable",
        component: VariableSets,
        name: "Variable Sets",
        meta: {
          icon: "🏠",
          showInNav: true,
        },
      },
      {
        path: "deployment/targets",
        component: Project,
        name: "Deployment Targets",
        meta: {
          icon: "🏠",
          showInNav: true,
        },
      },
      {
        path: "environments",
        component: Project,
        name: "Environments",
        meta: {
          icon: "🏠",
          showInNav: true,
        },
      },
      {
        path: "machine/policies",
        component: Project,
        name: "Machine Policies",
        meta: {
          icon: "🏠",
          showInNav: true,
        },
      },
      {
        path: "external/feeds",
        component: Project,
        name: "External Feeds",
        meta: {
          icon: "🏠",
          showInNav: true,
        },
      },
      {
        path: "lifecycles",
        component: Project,
        name: "Lifecycles",
        meta: {
          icon: "🏠",
          showInNav: true,
        },
      },
      {
        path: "project",
        component: Project,
        name: "Project",
        meta: {
          icon: "📁",
          showInNav: true,
        },
        children: [
          {
            path: ":projectName/project-detail",
            component: ProjectDetail,
            name: "Project Detail",
            meta: {
              icon: "📁",
              showInNav: true,
            },
            children: [
              {
                path: "",
                redirect: "deployments",
              },
              {
                path: "deployments",
                component: Deployments,
                name: "Deployments",
                meta: {
                  icon: "🚀",
                  showInNav: true,
                },
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: "/tasks",
    component: Tasks,
    name: "Tasks",
    meta: {
      icon: "📝",
      showInNav: true,
    },
  },
  {
    path: "*",
    component: NotFound,
    name: "404",
    meta: {
      showInNav: false,
    },
  },
];

export default routes;
