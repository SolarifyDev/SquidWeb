import Project from 'pages/project'
import NotFound from 'pages/notfound'
import Tasks from 'pages/tasks'

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
