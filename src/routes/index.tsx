import Project from "pages/project";
import NotFound from "pages/notfound";
import Tasks from "pages/tasks";
import VariableSets from "pages/variablesets";
import ProjectDetail from "pages/project-detail";
import Deployments from "pages/project-detail/Deployments";
import { redirect } from "react-router-dom";
import path from "path";

const routes = [
  {
    path: "/",
    children: [
      {
        path: "variable",
        component: VariableSets,
        name: "Variable Sets",
      },
      {
        path: "deployment/targets",
        component: Project,
        name: "Deployment Targets",
      },
      {
        path: "environments",
        component: Project,
        name: "Environments",
      },
      {
        path: "machine/policies",
        component: Project,
        name: "Machine Policies",
      },
      {
        path: "external/feeds",
        component: Project,
        name: "External Feeds",
      },
      {
        path: "lifecycles",
        component: Project,
        name: "Lifecycles",
      },
      {
        path: "project",
        component: Project,
        name: "Project",
      },
      {
        path: "project/:projectName/project-detail",
        component: ProjectDetail,
        name: "ProjectDetail",
        children: [
          {
            path: "",
            redirect: "deployments",
          },
          {
            path: "deployments",
            component: Deployments,
            name: "Deployments",
          },
        ],
      },
    ],
  },
  {
    path: "/tasks",
    component: Tasks,
    name: "Tasks",
  },
  {
    path: "*",
    component: NotFound,
    name: "404",
  },
];

export default routes;
