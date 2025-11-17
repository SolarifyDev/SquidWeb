import Project from 'pages/project'
import NotFound from 'pages/notfound'
import Tasks from 'pages/tasks'
import VariableSets from 'pages/variablesets'
import ExternalFeeds from 'pages/externalfeeds'
import Lifecycles from 'pages/lifecycles'

const routes = [
  {
    path: '/',
    component: Project,
    name: 'Deploy',
    meta: {
      icon: '🏠',
      showInNav: true
    }
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
    component: Project,
    name: 'Deployment Targets',
    meta: {
      icon: '🏠',
      showInNav: true
    }
  },
  {
    path: '/deploy/environments',
    component: Project,
    name: 'Environments',
    meta: {
      icon: '🏠',
      showInNav: true
    }
  },
  {
    path: '/deploy/machine/policies',
    component: Project,
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
    name: 'Tasks',
    meta: {
      icon: '📝',
      showInNav: true
    }
  },
  {
    path: '*',
    component: NotFound,
    name: '404',
    meta: {
      showInNav: false
    }
  }
]

export default routes
