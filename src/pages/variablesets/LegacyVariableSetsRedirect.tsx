import React from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'

const LegacyVariableSetsRedirect: React.FC = () => {
  const location = useLocation()
  const { spaceId = 'Spaces-1', id } = useParams<{ spaceId: string; id?: string }>()

  const suffix = id ? `/${id}` : ''

  return (
    <Navigate
      to={`/${spaceId}/library/variables${suffix}${location.search}${location.hash}`}
      replace
    />
  )
}

export default LegacyVariableSetsRedirect
