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
import Process from "pages/project-detail/process";
import ProcessEditor from "pages/project-detail/process/editor";
import Channels from "pages/project-detail/channels";
import ChannelItem from "pages/project-detail/channels/item";
import ProjectVariables from "pages/project-detail/variables";
import ProjectSetting from "pages/project-detail/project-setting";

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
          {
            path: "process",
            component: Process,
            name: "Process"
          },
          {
            path: "process/:stepId/editor",
            component: ProcessEditor,
            name: "ProcessEditor",
          },
          {
            path: "channels",
            component: Channels,
            name: "Channels",
          },
          {
            path: "channels/:channelId",
            component: ChannelItem,
            name: "ChannelItem",
          },
          {
            path: "variable",
            component: ProjectVariables,
            name: "ProjectVariables",
          },
          {
            path: "settings",
            component: ProjectSetting,
            name: "ProjectSetting",
          },
        ],
      },
    ],
  },
  {
    path: '/deploy/variable',
    component: VariableSets,
    name: 'Variable Sets',
    meta: {
      icon: '⚙️',
      showInNav: true
    }
  },
  {
    path: '/deploy/deployment/targets',
    component: DeploymentTargets,
    name: 'Deployment Targets',
    meta: {
      icon: '🏠',
      showInNav: true
    }
  },
  {
    path: '/deploy/environments',
    component: Environments,
    name: 'Environments',
    meta: {
      icon: '🏠',
      showInNav: true
    }
  },
  {
    path: '/deploy/machine/policies',
    component: MachinePolicies,
    name: 'Machine Policies',
    meta: {
      icon: '🏠',
      showInNav: true
    }
  },
  {
    path: '/deploy/external/feeds',
    component: ExternalFeeds,
    name: 'External Feeds',
    meta: {
      icon: '🏠',
      showInNav: true
    }
  },
  {
    path: '/deploy/lifecycles',
    component: Lifecycles,
    name: 'Lifecycles',
    meta: {
      icon: '🏠',
      showInNav: true
    }
  },
  {
    path: '/tasks',
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
