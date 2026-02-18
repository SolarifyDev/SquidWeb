import Project from 'pages/project'
import NotFound from 'pages/notfound'
import Tasks from 'pages/tasks'
import VariableSets from 'pages/variablesets'
import ExternalFeeds from 'pages/externalfeeds'
import Lifecycles from 'pages/lifecycles'
import DeploymentTargets from 'pages/deploymentTargets'
import Environments from 'pages/Environments/index'
import MachinePolicies from 'pages/machinePolicies'
import ProjectDetail from "pages/project-detail";
import Deployments from "pages/project-detail/Deployments";
import Process from "pages/project-detail/DeploymentProcess";

const routes = [
  {
    path: "/",
    children: [
      {
        path: "",
        redirect: "project",
      },
      {
        path: "variable",
        component: VariableSets,
        name: "Variable Sets",
      },
      {
        path: "deployment/targets",
        component: DeploymentTargets,
        name: "Deployment Targets",
      },
      {
        path: "environments",
        component: Environments,
        name: "Environments",
      },
      {
        path: "machine/policies",
        component: MachinePolicies,
        name: "Machine Policies",
      },
      {
        path: "external/feeds",
        component: ExternalFeeds,
        name: "External Feeds",
      },
      {
        path: "lifecycles",
        component: Lifecycles,
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
          {
            path: "process",
            component: Process,
            name: "Process",
          },
        ],
      },
      {
        path: "tasks",
        component: Tasks,
        name: "Tasks",
      },
      {
        path: "*",
        component: NotFound,
        name: "404",
      },
    ],
  },
];

export default routes;
