export class KubernetesProperties {
  private constructor() {}

  // Step level (not action level) - "Target Roles" in step header/settings.
  // Storage: comma-separated string, e.g. "kubernetes-worker,linux".
  static readonly TargetRoles = 'Squid.Action.TargetRoles'

  // Deployment - "Resource Type" selector.
  // Storage: "Deployment" (currently supported path).
  static readonly DeploymentResourceType = 'Squid.Action.KubernetesContainers.DeploymentResourceType'

  // Deployment - "Deployment Name" textbox.
  static readonly DeploymentName = 'Squid.Action.KubernetesContainers.DeploymentName'

  // Deployment - "Namespace" textbox.
  static readonly Namespace = 'Squid.Action.KubernetesContainers.Namespace'

  // Deployment - "Replicas" textbox.
  static readonly Replicas = 'Squid.Action.KubernetesContainers.Replicas'

  // Deployment - "Revision History Limit" textbox.
  static readonly RevisionHistoryLimit = 'Squid.Action.KubernetesContainers.RevisionHistoryLimit'

  // Deployment - "Progress Deadline Seconds" textbox.
  static readonly ProgressDeadlineSeconds = 'Squid.Action.KubernetesContainers.ProgressDeadlineSeconds'

  // Deployment - "Pod Termination Grace Period Seconds" textbox.
  static readonly PodTerminationGracePeriodSeconds = 'Squid.Action.KubernetesContainers.PodTerminationGracePeriodSeconds'

  // Deployment - "Pod Priority Class Name" textbox.
  static readonly PodPriorityClassName = 'Squid.Action.KubernetesContainers.PodPriorityClassName'

  // Deployment - "Pod Restart Policy" selector.
  static readonly PodRestartPolicy = 'Squid.Action.KubernetesContainers.PodRestartPolicy'

  // Deployment - "Pod DNS Policy" selector.
  static readonly PodDnsPolicy = 'Squid.Action.KubernetesContainers.PodDnsPolicy'

  // Deployment - "Pod DNS Nameservers" multiline textbox.
  // Storage: newline-separated list.
  static readonly PodDnsNameservers = 'Squid.Action.KubernetesContainers.PodDnsNameservers'

  // Deployment - "Pod DNS Searches" multiline textbox.
  // Storage: newline-separated list.
  static readonly PodDnsSearches = 'Squid.Action.KubernetesContainers.PodDnsSearches'

  // Deployment - "Readiness Gates" multiline textbox.
  // Storage: newline-separated list of condition types.
  static readonly PodReadinessGates = 'Squid.Action.KubernetesContainers.PodReadinessGates'

  // Deployment - "Service Account Name" textbox.
  static readonly ServiceAccountName = 'Squid.Action.KubernetesContainers.ServiceAccountName'

  // Deployment - "Host Networking" selector/radio.
  // Storage: "True" | "False".
  static readonly PodHostNetworking = 'Squid.Action.KubernetesContainers.PodHostNetworking'

  // Pod Security Context - fsGroup textbox.
  static readonly PodSecurityFsGroup = 'Squid.Action.KubernetesContainers.PodSecurityFsGroup'

  // Pod Security Context - runAsGroup textbox.
  static readonly PodSecurityRunAsGroup = 'Squid.Action.KubernetesContainers.PodSecurityRunAsGroup'

  // Pod Security Context - runAsUser textbox.
  static readonly PodSecurityRunAsUser = 'Squid.Action.KubernetesContainers.PodSecurityRunAsUser'

  // Pod Security Context - supplementalGroups textbox.
  // Storage: comma-separated list.
  static readonly PodSecuritySupplementalGroups = 'Squid.Action.KubernetesContainers.PodSecuritySupplementalGroups'

  // Pod Security Context - runAsNonRoot selector/radio.
  // Storage: "True" | "False" | "".
  static readonly PodSecurityRunAsNonRoot = 'Squid.Action.KubernetesContainers.PodSecurityRunAsNonRoot'

  // Pod Security Context - seLinuxOptions.level textbox.
  static readonly PodSecuritySeLinuxLevel = 'Squid.Action.KubernetesContainers.PodSecuritySeLinuxLevel'

  // Pod Security Context - seLinuxOptions.role textbox.
  static readonly PodSecuritySeLinuxRole = 'Squid.Action.KubernetesContainers.PodSecuritySeLinuxRole'

  // Pod Security Context - seLinuxOptions.type textbox.
  static readonly PodSecuritySeLinuxType = 'Squid.Action.KubernetesContainers.PodSecuritySeLinuxType'

  // Pod Security Context - seLinuxOptions.user textbox.
  static readonly PodSecuritySeLinuxUser = 'Squid.Action.KubernetesContainers.PodSecuritySeLinuxUser'

  // Deployment strategy - style selector.
  // Storage: "RollingUpdate" | "Recreate".
  static readonly DeploymentStyle = 'Squid.Action.KubernetesContainers.DeploymentStyle'

  // Deployment strategy - rollingUpdate.maxUnavailable.
  static readonly MaxUnavailable = 'Squid.Action.KubernetesContainers.MaxUnavailable'

  // Deployment strategy - rollingUpdate.maxSurge.
  static readonly MaxSurge = 'Squid.Action.KubernetesContainers.MaxSurge'

  // Deployment - "Deployment Labels" list editor.
  // Storage: JSON array [{ Key, Value }].
  static readonly DeploymentLabels = 'Squid.Action.KubernetesContainers.DeploymentLabels'

  // Deployment - "Deployment Annotations" list editor.
  // Storage: JSON array [{ Key, Value }].
  static readonly DeploymentAnnotations = 'Squid.Action.KubernetesContainers.DeploymentAnnotations'

  // Deployment - "Pod Annotations" list editor.
  // Storage: JSON array [{ Key, Value }].
  static readonly PodAnnotations = 'Squid.Action.KubernetesContainers.PodAnnotations'

  // Containers - full container table/forms.
  // Storage: JSON array of ContainerSpec.
  static readonly Containers = 'Squid.Action.KubernetesContainers.Containers'

  // Volumes - combined volume definitions.
  // Storage: JSON array of VolumeSpec.
  static readonly CombinedVolumes = 'Squid.Action.KubernetesContainers.CombinedVolumes'

  // Service - "Service Name" textbox.
  static readonly ServiceName = 'Squid.Action.KubernetesContainers.ServiceName'

  // Service - "Service Type" selector.
  // Storage: "ClusterIP" | "NodePort" | "LoadBalancer".
  static readonly ServiceType = 'Squid.Action.KubernetesContainers.ServiceType'

  // Service - optional "Cluster IP address" textbox.
  static readonly ServiceClusterIp = 'Squid.Action.KubernetesContainers.ServiceClusterIp'

  // Service - "Service Annotations" list editor.
  // Storage: JSON array [{ Key, Value }].
  static readonly ServiceAnnotations = 'Squid.Action.KubernetesContainers.ServiceAnnotations'

  // Service - "Service Ports" list editor.
  // Storage: JSON array of ServicePort-like objects.
  static readonly ServicePorts = 'Squid.Action.KubernetesContainers.ServicePorts'

  // ConfigMap - "Config Map Name" textbox.
  static readonly ConfigMapName = 'Squid.Action.KubernetesContainers.ConfigMapName'

  // ConfigMap - "Config Map Items" list editor.
  // Storage: JSON array [{ Key, Value }].
  static readonly ConfigMapValues = 'Squid.Action.KubernetesContainers.ConfigMapValues'

  // Ingress - "Ingress Name" textbox.
  static readonly IngressName = 'Squid.Action.KubernetesContainers.IngressName'

  // Ingress - "Ingress Class Name" textbox.
  static readonly IngressClassName = 'Squid.Action.KubernetesContainers.IngressClassName'

  // Ingress - "Ingress Annotations" list editor.
  // Storage: JSON array [{ Key, Value }].
  static readonly IngressAnnotations = 'Squid.Action.KubernetesContainers.IngressAnnotations'

  // Ingress - "Ingress Host Rules" list editor.
  // Storage: JSON array of IngressRule-like objects.
  static readonly IngressRules = 'Squid.Action.KubernetesContainers.IngressRules'

  // Ingress - "Ingress TLS" list editor.
  // Storage: JSON array of IngressTls-like objects.
  static readonly IngressTlsCertificates = 'Squid.Action.KubernetesContainers.IngressTlsCertificates'

  // Secret - "Secret Name" textbox.
  static readonly SecretName = 'Squid.Action.KubernetesContainers.SecretName'

  // Secret - "Secret Items" list editor.
  // Storage: JSON array [{ Key, Value }].
  static readonly SecretValues = 'Squid.Action.KubernetesContainers.SecretValues'

  // Status checks - object status behavior selector.
  // Storage: "disabled" | other backend-supported values.
  static readonly ObjectStatusCheck = 'Squid.Action.KubernetesContainers.ObjectStatusCheck'

  // Pod networking - host aliases list editor.
  // Storage: JSON array [{ ip, hostnames }].
  static readonly HostAliases = 'Squid.Action.KubernetesContainers.HostAliases'

  // Pod scheduling - tolerations list editor.
  // Storage: JSON array [{ key, operator, value, effect }].
  static readonly Tolerations = 'Squid.Action.KubernetesContainers.Tolerations'

  // Pod scheduling - nodeAffinity advanced editor.
  // Storage: raw JSON string for .spec.template.spec.affinity.nodeAffinity.
  static readonly NodeAffinity = 'Squid.Action.KubernetesContainers.NodeAffinity'

  // Pod scheduling - podAffinity advanced editor.
  // Storage: raw JSON string for .spec.template.spec.affinity.podAffinity.
  static readonly PodAffinity = 'Squid.Action.KubernetesContainers.PodAffinity'

  // Pod scheduling - podAntiAffinity advanced editor.
  // Storage: raw JSON string for .spec.template.spec.affinity.podAntiAffinity.
  static readonly PodAntiAffinity = 'Squid.Action.KubernetesContainers.PodAntiAffinity'

  // Pod Security Context - imagePullSecrets list editor.
  // Storage: JSON array [{ name }].
  static readonly PodSecurityImagePullSecrets = 'Squid.Action.KubernetesContainers.PodSecurityImagePullSecrets'

  // Pod Security Context - sysctls list editor.
  // Storage: JSON array [{ name, value }].
  static readonly PodSecuritySysctls = 'Squid.Action.KubernetesContainers.PodSecuritySysctls'

  // DNS config - options list editor.
  // Storage: JSON array [{ name, value }].
  static readonly DnsConfigOptions = 'Squid.Action.KubernetesContainers.DnsConfigOptions'
}

// Keys inside KubernetesProperties.Containers JSON payload.
// These are NOT action property names; they are fields for each "Add Container" item.
export class KubernetesContainerPayloadKeys {
  private constructor() {}

  // Container row basic fields (Add Container form).
  static readonly Name = 'Name' // Container name.
  static readonly Image = 'Image' // Container image reference.
  static readonly PackageId = 'PackageId' // Selected package id.
  static readonly FeedId = 'FeedId' // External feed id (number).
  static readonly CreateFeedSecrets = 'CreateFeedSecrets' // "True" | "False".
  static readonly IsInitContainer = 'IsInitContainer' // "True" | "False".

  // Complex object fields for each container item.
  static readonly Ports = 'Ports'
  static readonly Resources = 'Resources'
  static readonly VolumeMounts = 'VolumeMounts'
  static readonly ConfigMapEnvFromSource = 'ConfigMapEnvFromSource'
  static readonly LivenessProbe = 'LivenessProbe'
  static readonly ReadinessProbe = 'ReadinessProbe'
  static readonly StartupProbe = 'StartupProbe'
  static readonly SecurityContext = 'SecurityContext'
  static readonly Lifecycle = 'Lifecycle'
}

// Keys for item objects under Containers[].Ports.
export class KubernetesContainerPortPayloadKeys {
  private constructor() {}

  static readonly Name = 'key' // Port name (e.g. http).
  static readonly ContainerPort = 'value' // Container port number.
  static readonly Protocol = 'option' // TCP | UDP.
}

// Keys for Containers[].Resources object.
export class KubernetesContainerResourcePayloadKeys {
  private constructor() {}

  static readonly Requests = 'requests'
  static readonly Limits = 'limits'
  static readonly Cpu = 'cpu'
  static readonly Memory = 'memory'
}

// Keys for item objects under Containers[].VolumeMounts.
export class KubernetesContainerVolumeMountPayloadKeys {
  private constructor() {}

  static readonly VolumeName = 'key' // Name of volume in CombinedVolumes.
  static readonly MountPath = 'value' // Mount path in container.
  static readonly SubPath = 'option' // Optional subPath.
}

// Keys for item objects under Containers[].ConfigMapEnvFromSource.
export class KubernetesContainerEnvFromPayloadKeys {
  private constructor() {}

  static readonly ConfigMapName = 'key'
}

// Keys for Containers[].SecurityContext.
export class KubernetesContainerSecurityContextPayloadKeys {
  private constructor() {}

  static readonly RunAsUser = 'runAsUser'
  static readonly RunAsGroup = 'runAsGroup'
  static readonly RunAsNonRoot = 'runAsNonRoot'
  static readonly ReadOnlyRootFilesystem = 'readOnlyRootFilesystem'
  static readonly AllowPrivilegeEscalation = 'allowPrivilegeEscalation'
  static readonly Privileged = 'privileged'
}

// Keys for Containers[].Lifecycle.
export class KubernetesContainerLifecyclePayloadKeys {
  private constructor() {}

  static readonly PostStart = 'postStart'
  static readonly PreStop = 'preStop'
  static readonly Type = 'type'
  static readonly Command = 'command'
}

// Keys for Containers[].{LivenessProbe,ReadinessProbe,StartupProbe}.
export class KubernetesContainerProbePayloadKeys {
  private constructor() {}

  static readonly Type = 'type' // httpGet | tcpSocket | exec | "".
  static readonly HttpGet = 'httpGet'
  static readonly TcpSocket = 'tcpSocket'
  static readonly Exec = 'exec'
  static readonly InitialDelaySeconds = 'initialDelaySeconds'
  static readonly PeriodSeconds = 'periodSeconds'
  static readonly TimeoutSeconds = 'timeoutSeconds'
  static readonly SuccessThreshold = 'successThreshold'
  static readonly FailureThreshold = 'failureThreshold'
}
