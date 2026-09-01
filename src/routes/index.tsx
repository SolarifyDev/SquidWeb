import Project from 'pages/project'
import NotFound from 'pages/notfound'
import Tasks from 'pages/tasks'
import VariableSets from 'pages/variablesets'
import VariableSetDetail from 'pages/variablesets/detail'
import LegacyVariableSetsRedirect from 'pages/variablesets/LegacyVariableSetsRedirect'
import ExternalFeeds from 'pages/externalfeeds'
import CertificatesPage from 'pages/certificates'
import Lifecycles from 'pages/lifecycles'
import DeploymentTargets from 'pages/deploymentTargets'
import AddDeploymentTargetPage from 'pages/deploymentTargets/add'
import DeploymentTargetDetailPage from 'pages/deploymentTargets/detail'
import Environments from 'pages/Environments/index'
import MachinePolicies from 'pages/machinePolicies'
import MachinePolicyDetail from 'pages/machinePolicies/detail'
import Accounts from 'pages/accounts'
import AccountsCreatePage from 'pages/accounts/create'
import AccountsDetailPage from 'pages/accounts/detail'
import InfrastructureOverviewPage from 'pages/infrastructure/overview'
import OpenClawDirectChatPage from 'pages/chat'
import ChatEntryPage from 'pages/chat/entry'
import ProjectDetail from "pages/project-detail";
import ImportProjects from "pages/project/ImportProjects";
import Deployments from "pages/project-detail/Deployments";
import Process from "pages/project-detail/DeploymentProcess";
import ProjectVariables from "pages/project-detail/ProjectVariables";
import ProjectVariableSets from "pages/project-detail/ProjectVariableSets";
import ProjectAllVariables from "pages/project-detail/ProjectAllVariables";
import ProjectVariablePreview from "pages/project-detail/ProjectVariablePreview";
import ProjectTasks from "pages/project-detail/ProjectTasks";
import Channels from "pages/project-detail/Channels";
import ChannelDetail from "pages/project-detail/ChannelDetail";
import Releases from "pages/project-detail/Releases";
import ReleasesCreate from "pages/project-detail/ReleasesCreate";
import ReleaseDetail from "pages/project-detail/ReleaseDetail";
import DeployCreate from "pages/project-detail/DeployCreate";
import DeploymentDetail from "pages/project-detail/DeploymentDetail";
import LegacyProjectDetailRedirect from "pages/project-detail/LegacyProjectDetailRedirect";
import ProjectSettings from "pages/project-detail/ProjectSettings";
import DeploymentSettings from "pages/project-detail/DeploymentSettings";
import ProjectVersionControl from "pages/project-detail/ProjectVersionControl";
import SettingsPage from 'pages/settings'
import PersonalSettingsPage from 'pages/account/PersonalSettingsPage'

const routes = [
  {
    path: "/users/me",
    component: PersonalSettingsPage,
    name: "PersonalSettings",
  },
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
            path: "projects/import",
            component: ImportProjects,
            name: "ImportProjects",
          },
          {
            path: "chat",
            component: ChatEntryPage,
            name: "Chat",
          },
          {
            path: "chat/openclaw",
            component: OpenClawDirectChatPage,
            name: "OpenClaw Chat",
          },
          {
            path: "library/variables",
            component: VariableSets,
            name: "Variable Sets",
          },
          {
            path: "library/variables/:id/:tab?",
            component: VariableSetDetail,
            name: "Variable Set Detail",
          },
          {
            path: "variable",
            component: LegacyVariableSetsRedirect,
            name: "VariableSetsLegacyRedirect",
          },
          {
            path: "variable/:id",
            component: LegacyVariableSetsRedirect,
            name: "VariableSetLegacyRedirect",
          },
          {
            path: "deployment/targets/add",
            component: AddDeploymentTargetPage,
            name: "Add Deployment Target",
          },
          {
            path: "deployment/targets/:targetId/:tab?",
            component: DeploymentTargetDetailPage,
            name: "Deployment Target Detail",
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
            path: "infrastructure/overview",
            component: InfrastructureOverviewPage,
            name: "Infrastructure Overview",
          },
          {
            path: "infrastructure/machinepolicies/:policyId/:tab?",
            component: MachinePolicyDetail,
            name: "MachinePolicyDetail",
          },
          {
            path: "infrastructure/machinepolicies",
            component: MachinePolicies,
            name: "MachinePoliciesInfrastructure",
          },
          {
            path: "machine/policies/:policyId/:tab?",
            component: MachinePolicyDetail,
            name: "MachinePolicyDetailLegacy",
          },
          {
            path: "machine/policies",
            component: MachinePolicies,
            name: "Machine Policies",
          },
          {
            path: "infrastructure/accounts",
            component: Accounts,
            name: "Accounts",
          },
          {
            path: "infrastructure/accounts/create",
            component: AccountsCreatePage,
            name: "AccountsCreate",
          },
          {
            path: "infrastructure/accounts/:accountSlug/:tab?",
            component: AccountsDetailPage,
            name: "AccountsDetail",
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
            path: 'settings/*',
            component: SettingsPage,
            name: 'Settings',
          },
          {
            path: "projects/:projectName/project-detail/*",
            component: LegacyProjectDetailRedirect,
            name: "ProjectDetailLegacyRedirect",
          },
          {
            path: "projects/:projectName",
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
                redirect: "deployments/process",
                name: "ProcessLegacy",
              },
              {
                path: "process/*",
                component: Process,
                name: "ProcessLegacyWildcard",
              },
              {
                path: "deployments/process/*",
                component: Process,
                name: "Process",
              },
              {
                path: "channels",
                redirect: "deployments/channels",
                name: "ChannelsLegacy",
              },
              {
                path: "channels/edit/:channelId",
                component: ChannelDetail,
                name: "ChannelDetailLegacy",
              },
              {
                path: "deployments/channels",
                component: Channels,
                name: "Channels",
              },
              {
                path: "deployments/channels/edit/:channelId",
                component: ChannelDetail,
                name: "ChannelDetail",
              },
              {
                path: "deployments/settings",
                component: DeploymentSettings,
                name: "DeploymentSettings",
              },
              {
                path: "releases",
                component: Releases,
                name: "Releases",
              },
              {
                path: "releases/create",
                component: ReleasesCreate,
                name: "ReleasesCreate",
              },
              {
                path: "releases/:version/deployments/create",
                component: DeployCreate,
                name: "DeployCreate",
              },
              {
                path: "releases/:version/deployments/:deploymentId",
                component: DeploymentDetail,
                name: "DeploymentDetail",
              },
              {
                // Backward-compatible route
                path: "releases/:version/deploy",
                component: DeployCreate,
                name: "DeployCreateLegacy",
              },
              {
                path: "releases/:version",
                component: ReleaseDetail,
                name: "ReleaseDetail",
              },
              {
                path: "settings",
                component: ProjectSettings,
                name: "ProjectSettings",
              },
              {
                path: "settings/versioncontrol",
                component: ProjectVersionControl,
                name: "ProjectVersionControl",
              },
              {
                path: "variables/:tab?",
                component: ProjectVariables,
                name: "ProjectVariables",
              },
              {
                path: "variables/library",
                component: ProjectVariableSets,
                name: "ProjectVariableSets",
              },
              {
                path: "variables/all",
                component: ProjectAllVariables,
                name: "ProjectAllVariables",
              },
              {
                path: "variables/preview",
                component: ProjectVariablePreview,
                name: "ProjectVariablePreview",
              },
              {
                path: "tasks",
                component: ProjectTasks,
                name: "ProjectTasks",
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
