import React from 'react'
import { Button } from 'antd'
import { Link, useParams } from 'react-router-dom'
import PageContainer from 'components/PageContainer'

const ProjectVersionControl: React.FC = () => {
  const { spaceId, projectName } = useParams<{ spaceId: string; projectName: string }>()
  const projectSettingsPath = `/${spaceId}/projects/${projectName}/settings`

  return (
    <PageContainer>
        <div className="border border-slate-200/70 rounded-xl bg-white overflow-hidden shadow-card">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-gray-900 m-0 min-w-0">Version Control</h1>
            <Button type="primary" disabled>
              Save
            </Button>
          </div>

          <div className="px-6 py-5 border-b border-gray-200">
            <div className="text-sm text-slate-700 font-medium mb-2">Store project in Git (coming soon)</div>
            <div className="text-sm text-slate-600 leading-6">
              Version Control settings will be available here. You will be able to connect this project to a repository,
              define branch strategy, and manage synchronization behavior.
            </div>
          </div>

          <div className="px-6 py-4">
            <Link to={projectSettingsPath} className="text-squid-blue hover:underline text-sm font-medium">
              Back to Project Settings
            </Link>
          </div>
        </div>
    </PageContainer>
  )
}

export default ProjectVersionControl
