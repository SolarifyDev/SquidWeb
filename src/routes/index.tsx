import Project from 'pages/project'
import NotFound from 'pages/notfound'
import Tasks from 'pages/tasks'
import VariableSets from 'pages/variablesets'
import VariableSetDetail from 'pages/variablesets/detail'
import ExternalFeeds from 'pages/externalfeeds'
import CertificatesPage from 'pages/certificates'
import Lifecycles from 'pages/lifecycles'
import DeploymentTargets from 'pages/deploymentTargets'
import AddDeploymentTargetPage from 'pages/deploymentTargets/add'
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
        redirect: "Spaces-1/projects",
      },
      {
        path: ":spaceId",
        children: [
          {
            path: "",
            redirect: "projects",
          },
          {
            path: "projects",
            component: Project,
            name: "Project",
          },
          {
            path: "variable",
            component: VariableSets,
            name: "Variable Sets",
          },
          {
            path: "variable/:id",
            component: VariableSetDetail,
            name: "Variable Set Detail",
          },
          {
            path: "deployment/targets/add",
            component: AddDeploymentTargetPage,
            name: "Add Deployment Target",
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
            path: "library/certificates",
            component: CertificatesPage,
            name: "Certificates",
          },
          {
            path: "lifecycles",
            component: Lifecycles,
            name: "Lifecycles",
          },
          {
            path: "projects/:projectName/project-detail",
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
