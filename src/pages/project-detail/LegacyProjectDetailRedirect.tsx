import React from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";

const LegacyProjectDetailRedirect: React.FC = () => {
  const location = useLocation();
  const { spaceId = "Spaces-1", projectName = "", "*": rest = "" } = useParams<{
    spaceId: string;
    projectName: string;
    "*": string;
  }>();

  const suffix = rest ? `/${rest}` : "";
  const encodedProjectName = encodeURIComponent(projectName);

  return (
    <Navigate
      to={`/${spaceId}/projects/${encodedProjectName}${suffix}${location.search}${location.hash}`}
      replace
    />
  );
};

export default LegacyProjectDetailRedirect;
