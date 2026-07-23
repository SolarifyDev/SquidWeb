import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AutoComplete,
  Button,
  Checkbox,
  Input,
  Modal,
  Radio,
  Select,
  message,
} from "antd";
import { LinkOutlined, MoreOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  createDeploymentStep,
  getTargetRoles,
  updateDeploymentStep,
  type DeploymentActionDto,
  type DeploymentActionPropertyDto,
  type DeploymentStepDto,
  type DeploymentStepPropertyDto,
} from "pages/apis/deploymentProcess";
import {
  getExternalFeeds,
  searchExternalFeedPackages,
  type ExternalFeedDto,
} from "pages/apis/externalFeed";
import { CollapsibleSection } from "../shared/CollapsibleSection";
import {
  StepConditionsSection,
  type StepConditionsValue,
  type StepEnvironmentMode,
} from "../shared/StepConditionsSection";
import { TargetTagSelect } from "../shared/TargetTagSelect";
import type {
  StepEditorHandle,
  StepEditorProps,
} from "../shared/StepEditorTypes";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;
const ACTION_TYPE = "Squid.WindowsService";
const DEFAULT_STEP_NAME = "Deploy a Windows Service";
const FEATURES_PROPERTY = "Squid.Action.EnabledFeatures";
const STEP_CONDITION_EXPRESSION_PROPERTY = "Squid.Step.ConditionExpression";
const STEP_RETRIES_ENABLED_PROPERTY = "Squid.Step.RetriesEnabled";
const STEP_RETRIES_COUNT_PROPERTY = "Squid.Step.RetriesCount";
const STEP_TIMEOUT_PROPERTY = "Squid.Step.Timeout";
const STEP_TIMEOUT_MINUTES_LEGACY_PROPERTY = "Squid.Step.TimeoutInMinutes";
const STEP_MAX_PARALLELISM_PROPERTY = "Squid.Step.MaxParallelism";
const TARGET_ROLE_PROPERTY_NAMES = [
  "Squid.Action.TargetRoles",
  "TargetRoles",
] as const;

type WindowsServiceFeatureId =
  | "Squid.Features.CustomDirectory"
  | "Squid.Features.CustomScripts"
  | "Squid.Features.JsonConfigurationVariables"
  | "Squid.Features.ConfigurationVariables"
  | "Squid.Features.ConfigurationTransforms"
  | "Squid.Features.SubstituteInFiles"
  | "Squid.Features.PowerShellEdition";

interface WindowsServiceFeatureDescriptor {
  id: WindowsServiceFeatureId;
  name: string;
  description: React.ReactNode;
}

const WINDOWS_SERVICE_FEATURES: readonly WindowsServiceFeatureDescriptor[] = [
  {
    id: "Squid.Features.CustomDirectory",
    name: "Custom Installation Directory",
    description: "Change where Tentacle extracts your package",
  },
  {
    id: "Squid.Features.CustomScripts",
    name: "Custom Deployment Scripts",
    description:
      "Execute scripts during the deployment, without embedding them in your package",
  },
  {
    id: "Squid.Features.JsonConfigurationVariables",
    name: "Structured Configuration Variables",
    description:
      "Replace settings in JSON, YAML, XML, and Java Properties files with variables defined in Squid.",
  },
  {
    id: "Squid.Features.ConfigurationVariables",
    name: ".NET Configuration Variables",
    description: (
      <>
        Replace settings in any <em>.config</em> files with variables defined in
        Squid.
      </>
    ),
  },
  {
    id: "Squid.Features.ConfigurationTransforms",
    name: ".NET Configuration Transforms",
    description: (
      <>
        Runs configuration file transforms, such as <em>Web.Release.config</em>
      </>
    ),
  },
  {
    id: "Squid.Features.SubstituteInFiles",
    name: "Substitute Variables in Templates",
    description: (
      <>
        Transforms files using the Squid <code>#{"{Variable}"}</code>{" "}
        substitution syntax
      </>
    ),
  },
  {
    id: "Squid.Features.PowerShellEdition",
    name: "PowerShell Edition",
    description: "Specify the edition of PowerShell used during deployments",
  },
];

const DEFAULT_ENABLED_FEATURES: readonly WindowsServiceFeatureId[] = [
  "Squid.Features.ConfigurationVariables",
  "Squid.Features.ConfigurationTransforms",
];

const PackageProperties = {
  feedId: ["Squid.Action.Package.FeedId", "Octopus.Action.Package.FeedId"],
  packageId: [
    "Squid.Action.Package.PackageId",
    "Octopus.Action.Package.PackageId",
  ],
  version: [
    "Squid.Action.Package.PackageVersion",
    "Octopus.Action.Package.PackageVersion",
  ],
  customInstallationDirectory: [
    "Squid.Action.Package.CustomInstallationDirectory",
    "Octopus.Action.Package.CustomInstallationDirectory",
  ],
} as const;

const WindowsServiceProperties = {
  createOrUpdateService: [
    "Squid.Action.WindowsService.CreateOrUpdateService",
    "Octopus.Action.WindowsService.CreateOrUpdateService",
  ],
  serviceName: [
    "Squid.Action.WindowsService.ServiceName",
    "Octopus.Action.WindowsService.ServiceName",
  ],
  displayName: [
    "Squid.Action.WindowsService.DisplayName",
    "Octopus.Action.WindowsService.DisplayName",
  ],
  description: [
    "Squid.Action.WindowsService.Description",
    "Octopus.Action.WindowsService.Description",
  ],
  executablePath: [
    "Squid.Action.WindowsService.ExecutablePath",
    "Octopus.Action.WindowsService.ExecutablePath",
  ],
  arguments: [
    "Squid.Action.WindowsService.Arguments",
    "Octopus.Action.WindowsService.Arguments",
  ],
  serviceAccount: [
    "Squid.Action.WindowsService.ServiceAccount",
    "Octopus.Action.WindowsService.ServiceAccount",
  ],
  customAccountName: [
    "Squid.Action.WindowsService.CustomAccountName",
    "Octopus.Action.WindowsService.CustomAccountName",
  ],
  customAccountPassword: [
    "Squid.Action.WindowsService.CustomAccountPassword",
    "Octopus.Action.WindowsService.CustomAccountPassword",
  ],
  startMode: [
    "Squid.Action.WindowsService.StartMode",
    "Octopus.Action.WindowsService.StartMode",
  ],
  state: [
    "Squid.Action.WindowsService.State",
    "Octopus.Action.WindowsService.State",
  ],
  dependencies: [
    "Squid.Action.WindowsService.Dependencies",
    "Octopus.Action.WindowsService.Dependencies",
  ],
  replaceConfigVariables: [
    "Squid.Action.WindowsService.ConfigurationVariables.Enabled",
  ],
  runConfigTransforms: [
    "Squid.Action.WindowsService.ConfigurationTransforms.Enabled",
  ],
  configTransformsEnvironmentName: [
    "Squid.Action.WindowsService.ConfigurationTransforms.EnvironmentName",
  ],
  additionalTransforms: [
    "Squid.Action.WindowsService.ConfigurationTransforms.AdditionalTransforms",
  ],
  structuredConfigEnabled: [
    "Squid.Action.WindowsService.StructuredConfigurationVariables.Enabled",
  ],
  structuredConfigTargets: [
    "Squid.Action.WindowsService.StructuredConfigurationVariables.Targets",
  ],
  substituteTemplatesTargetFiles: [
    "Squid.Action.SubstituteInFiles.TargetFiles",
  ],
  substituteTemplatesOutputEncoding: [
    "Squid.Action.SubstituteInFiles.OutputEncoding",
  ],
  customScriptsPreDeploy: ["Squid.Action.CustomScripts.PreDeploy.ps1"],
  customScriptsPostDeploy: ["Squid.Action.CustomScripts.PostDeploy.ps1"],
  powerShellEdition: ["Squid.Action.PowerShellEdition"],
} as const;

const ActionPropertyFilterSet = new Set<string>([
  ...Object.values(PackageProperties).flat(),
  ...Object.values(WindowsServiceProperties).flat(),
]);
const StepPropertyFilterSet = new Set<string>([
  STEP_CONDITION_EXPRESSION_PROPERTY,
  STEP_RETRIES_ENABLED_PROPERTY,
  STEP_RETRIES_COUNT_PROPERTY,
  STEP_TIMEOUT_PROPERTY,
  STEP_TIMEOUT_MINUTES_LEGACY_PROPERTY,
  STEP_MAX_PARALLELISM_PROPERTY,
  ...TARGET_ROLE_PROPERTY_NAMES,
]);

type StartTriggerMode = "StartAfterPrevious" | "StartWithPrevious";
type ServiceAccountMode =
  | "LocalSystem"
  | "LocalService"
  | "NetworkService"
  | "_CUSTOM";
type WindowsServiceStartMode =
  | "auto"
  | "delayed-auto"
  | "demand"
  | "disabled"
  | "unchanged";
type WindowsServiceState = "Default" | "Started" | "Stopped" | "Unchanged";

interface WindowsServiceValues {
  packageFeedId: string;
  packageId: string;
  packageVersion: string;
  customInstallationDirectory: string;
  serviceName: string;
  displayName: string;
  description: string;
  executablePath: string;
  arguments: string;
  serviceAccount: ServiceAccountMode;
  customAccountName: string;
  customAccountPassword: string;
  startMode: WindowsServiceStartMode;
  state: WindowsServiceState;
  dependencies: string;
  enabledFeatures: ReadonlySet<WindowsServiceFeatureId>;
  replaceConfigVariables: boolean;
  runConfigTransforms: boolean;
  configTransformsEnvironmentName: string;
  additionalTransforms: string;
  structuredConfigEnabled: boolean;
  structuredConfigTargets: string;
  substituteTemplatesTargetFiles: string;
  substituteTemplatesOutputEncoding: string;
  customScriptsPreDeploy: string;
  customScriptsPostDeploy: string;
  powerShellEdition: "Desktop" | "Core";
}

function inferEnabledFeatures(
  action: DeploymentActionDto | undefined
): Set<WindowsServiceFeatureId> {
  const raw = getActionProperty(action, [FEATURES_PROPERTY]);
  if (raw != null) {
    const tokens = raw
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean);
    const allowed = new Set<string>(
      WINDOWS_SERVICE_FEATURES.map((feature) => feature.id)
    );
    return new Set(
      tokens.filter((token): token is WindowsServiceFeatureId =>
        allowed.has(token)
      )
    );
  }

  return new Set(DEFAULT_ENABLED_FEATURES);
}

function serializeEnabledFeatures(
  features: ReadonlySet<WindowsServiceFeatureId>
): string {
  return Array.from(features).sort().join(",");
}

function getActionProperty(
  action: DeploymentActionDto | undefined,
  names: readonly string[]
): string | undefined {
  if (!action) return undefined;
  for (const name of names) {
    const value = action.properties.find(
      (property) => property.propertyName === name
    )?.propertyValue;
    if (value != null) return value;
  }
  return undefined;
}

function getStepProperty(
  stepProperties: DeploymentStepPropertyDto[] | undefined,
  names: readonly string[]
): string {
  if (!stepProperties) return "";
  for (const name of names) {
    const value = stepProperties.find(
      (property) => property.propertyName === name
    )?.propertyValue;
    if (value != null) return value;
  }
  return "";
}

function normalizeBoolean(
  value: string | undefined,
  fallback = false
): boolean {
  if (!value?.trim()) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes")
    return true;
  if (normalized === "false" || normalized === "0" || normalized === "no")
    return false;
  return fallback;
}

function normalizeStartMode(
  value: string | undefined
): WindowsServiceStartMode {
  const normalized = (value ?? "").trim().toLowerCase();
  if (
    normalized === "delayed-auto" ||
    normalized === "automaticdelayed" ||
    normalized === "automatic (delayed)"
  )
    return "delayed-auto";
  if (normalized === "demand" || normalized === "manual") return "demand";
  if (normalized === "disabled") return "disabled";
  if (normalized === "unchanged") return "unchanged";
  return "auto";
}

function normalizeState(value: string | undefined): WindowsServiceState {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "started") return "Started";
  if (normalized === "stopped") return "Stopped";
  if (normalized === "unchanged") return "Unchanged";
  return "Default";
}

function normalizeServiceAccount(
  value: string | undefined
): ServiceAccountMode {
  const normalized = (value ?? "").trim();
  if (
    normalized === "_CUSTOM" ||
    normalized.toLowerCase() === "custom" ||
    normalized.toLowerCase() === "specificuser"
  )
    return "_CUSTOM";
  if (normalized === "LocalService") return "LocalService";
  if (normalized === "NetworkService") return "NetworkService";
  return "LocalSystem";
}

function buildActionProperties(
  existingAction: DeploymentActionDto | undefined,
  values: WindowsServiceValues
): DeploymentActionPropertyDto[] {
  const preserved = (existingAction?.properties ?? []).filter(
    (property) =>
      !ActionPropertyFilterSet.has(property.propertyName) &&
      !property.propertyName.startsWith("Octopus.")
  );

  const next: DeploymentActionPropertyDto[] = [...preserved];
  const pushProperty = (name: string, value: string, allowEmpty = false) => {
    if (!allowEmpty && value.trim() === "") return;
    next.push({
      id: 0,
      actionId: existingAction?.id ?? 0,
      propertyName: name,
      propertyValue: value,
    });
  };

  pushProperty(PackageProperties.feedId[0], values.packageFeedId);
  pushProperty(PackageProperties.packageId[0], values.packageId);
  pushProperty(PackageProperties.version[0], values.packageVersion);
  if (values.enabledFeatures.has("Squid.Features.CustomDirectory")) {
    pushProperty(
      PackageProperties.customInstallationDirectory[0],
      values.customInstallationDirectory,
      true
    );
  }

  pushProperty(WindowsServiceProperties.createOrUpdateService[0], "true");
  pushProperty(WindowsServiceProperties.serviceName[0], values.serviceName);
  pushProperty(
    WindowsServiceProperties.displayName[0],
    values.displayName,
    true
  );
  pushProperty(
    WindowsServiceProperties.description[0],
    values.description,
    true
  );
  pushProperty(
    WindowsServiceProperties.executablePath[0],
    values.executablePath
  );
  pushProperty(WindowsServiceProperties.arguments[0], values.arguments, true);
  pushProperty(
    WindowsServiceProperties.serviceAccount[0],
    values.serviceAccount
  );
  if (values.serviceAccount === "_CUSTOM") {
    pushProperty(
      WindowsServiceProperties.customAccountName[0],
      values.customAccountName
    );
    pushProperty(
      WindowsServiceProperties.customAccountPassword[0],
      values.customAccountPassword,
      true
    );
  }
  pushProperty(WindowsServiceProperties.startMode[0], values.startMode);
  pushProperty(WindowsServiceProperties.state[0], values.state);
  pushProperty(
    WindowsServiceProperties.dependencies[0],
    values.dependencies,
    true
  );
  if (values.enabledFeatures.has("Squid.Features.ConfigurationVariables")) {
    pushProperty(
      WindowsServiceProperties.replaceConfigVariables[0],
      values.replaceConfigVariables ? "True" : "False"
    );
  }
  if (values.enabledFeatures.has("Squid.Features.ConfigurationTransforms")) {
    pushProperty(
      WindowsServiceProperties.runConfigTransforms[0],
      values.runConfigTransforms ? "True" : "False"
    );
    pushProperty(
      WindowsServiceProperties.configTransformsEnvironmentName[0],
      values.configTransformsEnvironmentName,
      true
    );
    pushProperty(
      WindowsServiceProperties.additionalTransforms[0],
      values.additionalTransforms,
      true
    );
  }
  if (values.enabledFeatures.has("Squid.Features.JsonConfigurationVariables")) {
    pushProperty(
      WindowsServiceProperties.structuredConfigEnabled[0],
      values.structuredConfigEnabled ? "True" : "False"
    );
    pushProperty(
      WindowsServiceProperties.structuredConfigTargets[0],
      values.structuredConfigTargets,
      true
    );
  }
  if (values.enabledFeatures.has("Squid.Features.SubstituteInFiles")) {
    pushProperty(
      WindowsServiceProperties.substituteTemplatesTargetFiles[0],
      values.substituteTemplatesTargetFiles,
      true
    );
    pushProperty(
      WindowsServiceProperties.substituteTemplatesOutputEncoding[0],
      values.substituteTemplatesOutputEncoding,
      true
    );
  }
  if (values.enabledFeatures.has("Squid.Features.CustomScripts")) {
    pushProperty(
      WindowsServiceProperties.customScriptsPreDeploy[0],
      values.customScriptsPreDeploy,
      true
    );
    pushProperty(
      WindowsServiceProperties.customScriptsPostDeploy[0],
      values.customScriptsPostDeploy,
      true
    );
  }
  if (values.enabledFeatures.has("Squid.Features.PowerShellEdition")) {
    pushProperty(
      WindowsServiceProperties.powerShellEdition[0],
      values.powerShellEdition
    );
  }
  pushProperty(
    FEATURES_PROPERTY,
    serializeEnabledFeatures(values.enabledFeatures),
    true
  );

  return next;
}

function buildStepProperties(
  existingStepProperties: DeploymentStepPropertyDto[] | undefined,
  stepId: number,
  conditions: StepConditionsValue,
  targetTags: string[],
  maxParallelism: number
): DeploymentStepPropertyDto[] {
  const preserved = (existingStepProperties ?? []).filter(
    (property) => !StepPropertyFilterSet.has(property.propertyName)
  );
  const next: DeploymentStepPropertyDto[] = [...preserved];

  if (
    conditions.runCondition === "Variable" &&
    conditions.conditionExpression.trim()
  ) {
    next.push({
      id: 0,
      stepId,
      propertyName: STEP_CONDITION_EXPRESSION_PROPERTY,
      propertyValue: conditions.conditionExpression.trim(),
    });
  }

  if (targetTags.length > 0) {
    next.push({
      id: 0,
      stepId,
      propertyName: TARGET_ROLE_PROPERTY_NAMES[0],
      propertyValue: targetTags.join(","),
    });
  }

  if (maxParallelism > 0) {
    next.push({
      id: 0,
      stepId,
      propertyName: STEP_MAX_PARALLELISM_PROPERTY,
      propertyValue: String(maxParallelism),
    });
  }

  return next;
}

export const WindowsServiceEditor = forwardRef<
  StepEditorHandle,
  StepEditorProps
>(function WindowsServiceEditor(
  { step, processId, projectId, spaceId, stepIndex, onSave, onStepNameChange },
  ref
) {
  const action = step?.actions[0];
  const includeEnvironments = action?.environments ?? [];
  const excludeEnvironments = action?.excludedEnvironments ?? [];
  const initialEnvironmentMode: StepEnvironmentMode =
    excludeEnvironments.length > 0
      ? "exclude"
      : includeEnvironments.length > 0
        ? "include"
        : "all";

  const [stepName, setStepName] = useState(step?.name ?? DEFAULT_STEP_NAME);
  const [targetTags, setTargetTags] = useState<string[]>(() =>
    step ? getTargetRoles(step) : []
  );
  const [conditions, setConditions] = useState<StepConditionsValue>({
    environmentMode: initialEnvironmentMode,
    environmentIds:
      initialEnvironmentMode === "exclude"
        ? excludeEnvironments
        : includeEnvironments,
    channelIds: action?.channels ?? [],
    runCondition: step?.condition ?? "Success",
    conditionExpression: getStepProperty(step?.properties, [
      STEP_CONDITION_EXPRESSION_PROPERTY,
    ]),
    packageRequirement: step?.packageRequirement ?? "LetSquidDecide",
    required: step?.isRequired ?? false,
    disabled: step?.isDisabled ?? false,
  });
  const [startTrigger, setStartTrigger] = useState<StartTriggerMode>(
    step?.startTrigger === "StartWithPrevious"
      ? "StartWithPrevious"
      : "StartAfterPrevious"
  );
  const [retriesEnabled, setRetriesEnabled] = useState(
    normalizeBoolean(
      getStepProperty(step?.properties, [STEP_RETRIES_ENABLED_PROPERTY])
    )
  );
  const [retryCount, setRetryCount] = useState(() => {
    const raw = getStepProperty(step?.properties, [
      STEP_RETRIES_COUNT_PROPERTY,
    ]);
    return raw && /^\d+$/.test(raw) ? Math.min(Math.max(Number(raw), 1), 3) : 1;
  });
  const [stepTimeoutSeconds, setStepTimeoutSeconds] = useState(() => {
    const raw = getStepProperty(step?.properties, [
      STEP_TIMEOUT_PROPERTY,
      STEP_TIMEOUT_MINUTES_LEGACY_PROPERTY,
    ]);
    return raw && /^\d+$/.test(raw) ? Number(raw) : 0;
  });
  const [maxParallelism, setMaxParallelism] = useState(() => {
    const raw = getStepProperty(step?.properties, [
      STEP_MAX_PARALLELISM_PROPERTY,
    ]);
    return raw && /^\d+$/.test(raw) ? Number(raw) : 0;
  });

  const [packageFeedId, setPackageFeedId] = useState(
    getActionProperty(action, PackageProperties.feedId) ?? ""
  );
  const [packageId, setPackageId] = useState(
    getActionProperty(action, PackageProperties.packageId) ?? ""
  );
  const [packageVersion, setPackageVersion] = useState(
    getActionProperty(action, PackageProperties.version) ?? ""
  );
  const [customInstallationDirectory, setCustomInstallationDirectory] =
    useState(
      getActionProperty(
        action,
        PackageProperties.customInstallationDirectory
      ) ?? ""
    );
  const [feedsLoading, setFeedsLoading] = useState(false);
  const [feeds, setFeeds] = useState<ExternalFeedDto[]>([]);
  const [feedOptions, setFeedOptions] = useState<
    { label: string; value: string }[]
  >([]);
  const [packageSearchTerm, setPackageSearchTerm] = useState(packageId);
  const [packageSearchOptions, setPackageSearchOptions] = useState<string[]>(
    []
  );
  const [packageSearchLoading, setPackageSearchLoading] = useState(false);
  const packageSearchRequestId = useRef(0);

  const [serviceName, setServiceName] = useState(
    getActionProperty(action, WindowsServiceProperties.serviceName) ?? ""
  );
  const [displayName, setDisplayName] = useState(
    getActionProperty(action, WindowsServiceProperties.displayName) ?? ""
  );
  const [description, setDescription] = useState(
    getActionProperty(action, WindowsServiceProperties.description) ?? ""
  );
  const [executablePath, setExecutablePath] = useState(
    getActionProperty(action, WindowsServiceProperties.executablePath) ?? ""
  );
  const [argumentsValue, setArgumentsValue] = useState(
    getActionProperty(action, WindowsServiceProperties.arguments) ?? ""
  );
  const [serviceAccount, setServiceAccount] = useState<ServiceAccountMode>(
    normalizeServiceAccount(
      getActionProperty(action, WindowsServiceProperties.serviceAccount)
    )
  );
  const [customAccountName, setCustomAccountName] = useState(
    getActionProperty(action, WindowsServiceProperties.customAccountName) ?? ""
  );
  const [customAccountPassword, setCustomAccountPassword] = useState(
    getActionProperty(action, WindowsServiceProperties.customAccountPassword) ??
      ""
  );
  const [startMode, setStartMode] = useState<WindowsServiceStartMode>(
    normalizeStartMode(
      getActionProperty(action, WindowsServiceProperties.startMode)
    )
  );
  const [state, setState] = useState<WindowsServiceState>(
    normalizeState(getActionProperty(action, WindowsServiceProperties.state))
  );
  const [dependencies, setDependencies] = useState(
    getActionProperty(action, WindowsServiceProperties.dependencies) ?? ""
  );
  const [replaceConfigVariables, setReplaceConfigVariables] = useState(
    normalizeBoolean(
      getActionProperty(
        action,
        WindowsServiceProperties.replaceConfigVariables
      ),
      true
    )
  );
  const [runConfigTransforms, setRunConfigTransforms] = useState(
    normalizeBoolean(
      getActionProperty(action, WindowsServiceProperties.runConfigTransforms),
      true
    )
  );
  const [configTransformsEnvironmentName, setConfigTransformsEnvironmentName] =
    useState(
      getActionProperty(
        action,
        WindowsServiceProperties.configTransformsEnvironmentName
      ) ?? "#{Squid.Environment.Name}"
    );
  const [additionalTransforms, setAdditionalTransforms] = useState(
    getActionProperty(action, WindowsServiceProperties.additionalTransforms) ??
      ""
  );
  const [structuredConfigEnabled, setStructuredConfigEnabled] = useState(
    normalizeBoolean(
      getActionProperty(
        action,
        WindowsServiceProperties.structuredConfigEnabled
      ),
      false
    )
  );
  const [structuredConfigTargets, setStructuredConfigTargets] = useState(
    getActionProperty(
      action,
      WindowsServiceProperties.structuredConfigTargets
    ) ?? ""
  );
  const [substituteTemplatesTargetFiles, setSubstituteTemplatesTargetFiles] =
    useState(
      getActionProperty(
        action,
        WindowsServiceProperties.substituteTemplatesTargetFiles
      ) ?? ""
    );
  const [
    substituteTemplatesOutputEncoding,
    setSubstituteTemplatesOutputEncoding,
  ] = useState(
    getActionProperty(
      action,
      WindowsServiceProperties.substituteTemplatesOutputEncoding
    ) ?? ""
  );
  const [customScriptsPreDeploy, setCustomScriptsPreDeploy] = useState(
    getActionProperty(
      action,
      WindowsServiceProperties.customScriptsPreDeploy
    ) ?? ""
  );
  const [customScriptsPostDeploy, setCustomScriptsPostDeploy] = useState(
    getActionProperty(
      action,
      WindowsServiceProperties.customScriptsPostDeploy
    ) ?? ""
  );
  const [powerShellEdition, setPowerShellEdition] = useState<
    "Desktop" | "Core"
  >(
    getActionProperty(action, WindowsServiceProperties.powerShellEdition) ===
      "Core"
      ? "Core"
      : "Desktop"
  );
  const initialEnabledFeatures = useMemo(
    () => inferEnabledFeatures(action),
    [action]
  );
  const [enabledFeatures, setEnabledFeatures] = useState<
    ReadonlySet<WindowsServiceFeatureId>
  >(initialEnabledFeatures);
  const [featuresModalOpen, setFeaturesModalOpen] = useState(false);
  const [featuresDraft, setFeaturesDraft] = useState<
    ReadonlySet<WindowsServiceFeatureId>
  >(initialEnabledFeatures);

  const openFeaturesModal = () => {
    setFeaturesDraft(new Set(enabledFeatures));
    setFeaturesModalOpen(true);
  };

  const closeFeaturesModal = () => {
    setFeaturesModalOpen(false);
  };

  const toggleFeatureDraft = (
    id: WindowsServiceFeatureId,
    checked: boolean
  ) => {
    setFeaturesDraft((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const saveFeatures = () => {
    setEnabledFeatures(new Set(featuresDraft));
    setFeaturesModalOpen(false);
  };

  useEffect(() => {
    onStepNameChange?.(stepName);
  }, [stepName, onStepNameChange]);

  useEffect(() => {
    setPackageSearchTerm(packageId);
  }, [packageId]);

  const loadFeeds = useCallback(async () => {
    setFeedsLoading(true);
    try {
      const response = await getExternalFeeds({ pageSize: 1000 });
      const sorted = [...(response.externalFeeds ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      setFeeds(sorted);
      setFeedOptions(
        sorted.map((feed) => ({ label: feed.name, value: String(feed.id) }))
      );
    } catch {
      message.error("Failed to load feeds");
    } finally {
      setFeedsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFeeds();
  }, [loadFeeds]);

  const selectedFeedId = useMemo(() => {
    const parsed = Number.parseInt(packageFeedId, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  }, [packageFeedId]);

  const selectedFeedName = useMemo(() => {
    if (!selectedFeedId) return "";
    return feeds.find((feed) => feed.id === selectedFeedId)?.name ?? "";
  }, [feeds, selectedFeedId]);

  const feedSelectOptions = useMemo(() => {
    if (!packageFeedId.trim()) return feedOptions;
    if (feedOptions.some((option) => option.value === packageFeedId))
      return feedOptions;
    return [
      ...feedOptions,
      { label: `Feed #${packageFeedId}`, value: packageFeedId },
    ];
  }, [feedOptions, packageFeedId]);

  useEffect(() => {
    const query = packageSearchTerm.trim();
    if (!selectedFeedId || !query) {
      setPackageSearchOptions([]);
      setPackageSearchLoading(false);
      return;
    }

    const requestId = ++packageSearchRequestId.current;
    const timer = window.setTimeout(() => {
      setPackageSearchLoading(true);
      searchExternalFeedPackages({ feedId: selectedFeedId, query, take: 20 })
        .then((response) => {
          if (requestId !== packageSearchRequestId.current) return;
          setPackageSearchOptions((response.packages ?? []).filter(Boolean));
        })
        .catch(() => {
          if (requestId !== packageSearchRequestId.current) return;
          setPackageSearchOptions([]);
        })
        .finally(() => {
          if (requestId !== packageSearchRequestId.current) return;
          setPackageSearchLoading(false);
        });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [selectedFeedId, packageSearchTerm]);

  const handleSave = async () => {
    const normalizedStepName = stepName.trim();
    if (!normalizedStepName) {
      message.warning("Step name is required");
      return;
    }

    if (targetTags.length === 0) {
      message.warning("You need at least one target tag");
      return;
    }

    if (!packageFeedId.trim() || !packageId.trim()) {
      message.warning("Package feed and package ID are required");
      return;
    }

    if (!serviceName.trim()) {
      message.warning("Service name is required");
      return;
    }

    if (!executablePath.trim()) {
      message.warning("Executable path is required");
      return;
    }

    if (serviceAccount === "_CUSTOM" && !customAccountName.trim()) {
      message.warning(
        "Username is required when using a custom service account"
      );
      return;
    }

    if (retriesEnabled && (retryCount < 1 || retryCount > 3)) {
      message.warning("Retries must be between 1 and 3");
      return;
    }

    if (stepTimeoutSeconds < 0) {
      message.warning("Time out must be zero or a positive integer");
      return;
    }

    if (maxParallelism < 0) {
      message.warning("Max parallelism must be zero or a positive integer");
      return;
    }

    const actionValues: WindowsServiceValues = {
      packageFeedId,
      packageId,
      packageVersion,
      customInstallationDirectory,
      serviceName,
      displayName,
      description,
      executablePath,
      arguments: argumentsValue,
      serviceAccount,
      customAccountName,
      customAccountPassword,
      startMode,
      state,
      dependencies,
      enabledFeatures,
      replaceConfigVariables,
      runConfigTransforms,
      configTransformsEnvironmentName,
      additionalTransforms,
      structuredConfigEnabled,
      structuredConfigTargets,
      substituteTemplatesTargetFiles,
      substituteTemplatesOutputEncoding,
      customScriptsPreDeploy,
      customScriptsPostDeploy,
      powerShellEdition,
    };

    const actionProperties = buildActionProperties(action, actionValues);
    const stepProperties = buildStepProperties(
      step?.properties,
      step?.id ?? 0,
      conditions,
      targetTags,
      maxParallelism
    );
    const actionEnvironments =
      conditions.environmentMode === "include" ? conditions.environmentIds : [];
    const actionExcludedEnvironments =
      conditions.environmentMode === "exclude" ? conditions.environmentIds : [];
    const nextAction: DeploymentActionDto = {
      id: action?.id ?? 0,
      stepId: step?.id ?? 0,
      actionOrder: action?.actionOrder ?? 0,
      name: normalizedStepName,
      actionType: ACTION_TYPE,
      workerPoolId: action?.workerPoolId ?? null,
      isDisabled: conditions.disabled,
      isRequired: action?.isRequired ?? false,
      canBeUsedForProjectVersioning:
        action?.canBeUsedForProjectVersioning ?? false,
      createdAt: action?.createdAt ?? new Date().toISOString(),
      properties: actionProperties,
      environments: actionEnvironments,
      excludedEnvironments: actionExcludedEnvironments,
      channels: conditions.channelIds,
    };

    const nextStep: DeploymentStepDto = {
      id: step?.id ?? 0,
      processId,
      stepOrder: step?.stepOrder ?? 0,
      name: normalizedStepName,
      stepType: step?.stepType ?? "Action",
      condition: conditions.runCondition,
      startTrigger,
      packageRequirement: conditions.packageRequirement,
      isDisabled: conditions.disabled,
      isRequired: conditions.required,
      createdAt: step?.createdAt ?? new Date().toISOString(),
      properties: stepProperties,
      actions: [nextAction],
    };

    try {
      const saved = step
        ? await updateDeploymentStep({ id: step.id, step: nextStep })
        : await createDeploymentStep({ processId, step: nextStep });
      message.success(step ? "Step updated" : "Step created");
      onSave(saved);
    } catch {
      message.error("Failed to save step");
    }
  };

  useImperativeHandle(ref, () => ({ save: handleSave }), [
    stepName,
    targetTags,
    conditions,
    startTrigger,
    retriesEnabled,
    retryCount,
    stepTimeoutSeconds,
    maxParallelism,
    packageFeedId,
    packageId,
    packageVersion,
    customInstallationDirectory,
    serviceName,
    displayName,
    description,
    executablePath,
    argumentsValue,
    serviceAccount,
    customAccountName,
    customAccountPassword,
    startMode,
    state,
    dependencies,
    enabledFeatures,
    replaceConfigVariables,
    runConfigTransforms,
    configTransformsEnvironmentName,
    additionalTransforms,
    structuredConfigEnabled,
    structuredConfigTargets,
    substituteTemplatesTargetFiles,
    substituteTemplatesOutputEncoding,
    customScriptsPreDeploy,
    customScriptsPostDeploy,
    powerShellEdition,
    processId,
    step,
  ]);

  const logoUrl = `${API_BASE}/${spaceId}/actiontemplates/${ACTION_TYPE}/logo`;
  const displayStepName = stepName.trim() || DEFAULT_STEP_NAME;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-slate-100">
            <img
              src={logoUrl}
              alt="Logo"
              className="h-full w-full object-contain"
              onError={(event) => {
                (event.currentTarget as HTMLImageElement).style.display =
                  "none";
              }}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs leading-tight text-slate-400">
              <span>Deploy a Windows Service</span>
            </div>
            <div className="flex items-center gap-1.5">
              {stepIndex != null ? (
                <span className="text-sm font-medium text-slate-400">
                  {stepIndex + 1}.
                </span>
              ) : null}
              <span className="truncate text-sm font-semibold text-slate-800">
                {displayStepName}
              </span>
            </div>
          </div>
        </div>

        <button
          className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
          aria-label="More Step Actions"
        >
          <MoreOutlined style={{ fontSize: 18 }} />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        <CollapsibleSection
          title="Step Name"
          subtitle="A short, memorable, unique name for this step."
          defaultOpen
        >
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Step name
          </label>
          <Input
            size="small"
            value={stepName}
            onChange={(event) => setStepName(event.target.value)}
            placeholder={DEFAULT_STEP_NAME}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Target Tags"
          subtitle="This step will deploy to deployment targets with any of these matching tags."
          defaultOpen
        >
          <TargetTagSelect
            value={targetTags}
            onChange={setTargetTags}
            placeholder="Runs on targets with tags (type to add new)"
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Package Details"
          subtitle="Configure package source and version for Windows Service deployment."
          defaultOpen
          fullWidth
        >
          <CollapsibleSection
            title="Package"
            subtitle="Select the package containing your application."
            defaultOpen
            fullWidth
          >
            <div className="ml-[216px] space-y-4">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Package feed
                  </label>
                  <Select
                    value={packageFeedId || undefined}
                    options={feedSelectOptions}
                    onChange={(value) => {
                      const normalizedValue = String(value ?? "").trim();
                      setPackageFeedId(normalizedValue);
                      if (!normalizedValue) {
                        setPackageId("");
                        setPackageSearchTerm("");
                        setPackageSearchOptions([]);
                        return;
                      }
                      setPackageSearchTerm(packageId);
                    }}
                    size="small"
                    className="w-full"
                    showSearch
                    loading={feedsLoading}
                    allowClear
                    optionFilterProp="label"
                    placeholder="Select a feed..."
                  />
                </div>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
                  aria-label="Refresh feeds"
                  onClick={() => void loadFeeds()}
                >
                  <ReloadOutlined style={{ fontSize: 13 }} />
                </button>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Package ID
                </label>
                <AutoComplete
                  size="small"
                  className="w-full min-w-0"
                  value={packageId}
                  placeholder="my-service"
                  options={packageSearchOptions.map((value) => ({ value }))}
                  onSearch={setPackageSearchTerm}
                  onSelect={(value) => {
                    setPackageSearchTerm(value);
                    setPackageId(value);
                  }}
                  onChange={(value) => {
                    setPackageSearchTerm(value);
                    setPackageId(value);
                  }}
                  filterOption={false}
                  allowClear
                  notFoundContent={
                    selectedFeedId && packageSearchTerm.trim()
                      ? packageSearchLoading
                        ? "Searching packages..."
                        : "No packages found"
                      : null
                  }
                />
                <p className="mb-0 mt-1 text-xs text-slate-500">
                  Enter the ID of the package.
                  {selectedFeedName ? (
                    <>
                      {" "}
                      Searching in <code>{selectedFeedName}</code>.
                    </>
                  ) : null}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Version (optional)
                </label>
                <Input
                  size="small"
                  value={packageVersion}
                  onChange={(event) => setPackageVersion(event.target.value)}
                  placeholder="1.0.0"
                />
                <p className="mb-0 mt-1 text-xs text-slate-500">
                  Package will be locked to this version.
                </p>
              </div>
            </div>
          </CollapsibleSection>
        </CollapsibleSection>

        {enabledFeatures.has("Squid.Features.CustomDirectory") ? (
          <CollapsibleSection
            title="Custom Installation Directory"
            subtitle="Change where Tentacle extracts your package."
            defaultOpen
            fullWidth
          >
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Custom install directory
                </label>
                <Input
                  size="small"
                  value={customInstallationDirectory}
                  onChange={(event) =>
                    setCustomInstallationDirectory(event.target.value)
                  }
                  placeholder="C:\\Services\\MyService"
                />
              </div>
              <p className="mb-0 text-xs text-slate-500">
                Leave empty to install the package to the standard location.
              </p>
            </div>
          </CollapsibleSection>
        ) : null}

        <CollapsibleSection
          title="Windows Service"
          subtitle="Configure a windows service deployment."
          defaultOpen
          fullWidth
        >
          <div className="space-y-4">
            <CollapsibleSection
              title="Windows Service"
              subtitle="Configure the Windows Service that will be created or updated."
              defaultOpen
              fullWidth
            >
              <div className="ml-[216px] space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Service name
                  </label>
                  <Input
                    size="small"
                    value={serviceName}
                    onChange={(event) => setServiceName(event.target.value)}
                    placeholder="Service Name"
                  />
                  <p className="mb-0 mt-1 text-xs text-slate-500">
                    The name of the Windows Service to create or configure.
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Display name
                  </label>
                  <Input
                    size="small"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Service Name"
                  />
                  <p className="mb-0 mt-1 text-xs text-slate-500">
                    Optional display name of the Windows Service.
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Description
                  </label>
                  <Input.TextArea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Description"
                    autoSize={{ minRows: 2, maxRows: 4 }}
                  />
                  <p className="mb-0 mt-1 text-xs text-slate-500">
                    User-friendly description of the service.
                  </p>
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Windows Service: Executable"
              subtitle="Configure the executable of the service."
              defaultOpen
              fullWidth
            >
              <div className="ml-[216px] space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Executable path
                  </label>
                  <Input
                    size="small"
                    value={executablePath}
                    onChange={(event) => setExecutablePath(event.target.value)}
                    placeholder="bin\\MyService.exe"
                  />
                  <p className="mb-0 mt-1 text-xs text-slate-500">
                    The path should be relative to the package installation
                    directory.
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Arguments
                  </label>
                  <Input
                    size="small"
                    value={argumentsValue}
                    onChange={(event) => setArgumentsValue(event.target.value)}
                    placeholder="--environment production"
                  />
                  <p className="mb-0 mt-1 text-xs text-slate-500">
                    Command line arguments that will be passed to the service
                    when it starts each time.
                  </p>
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Windows Service: Startup"
              subtitle="Configure the startup options of the service."
              defaultOpen
              fullWidth
            >
              <div className="ml-[216px] space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Service account
                  </label>
                  <Select
                    value={serviceAccount}
                    onChange={(value) =>
                      setServiceAccount(value as ServiceAccountMode)
                    }
                    className="w-full"
                    options={[
                      { label: "Local System", value: "LocalSystem" },
                      { label: "Local Service", value: "LocalService" },
                      { label: "Network Service", value: "NetworkService" },
                      { label: "Custom user", value: "_CUSTOM" },
                    ]}
                  />
                  <p className="mb-0 mt-1 text-xs text-slate-500">
                    Which built-in account will the service run under.
                  </p>
                </div>

                {serviceAccount === "_CUSTOM" ? (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Username
                      </label>
                      <Input
                        size="small"
                        value={customAccountName}
                        onChange={(event) =>
                          setCustomAccountName(event.target.value)
                        }
                        placeholder="domain\\user"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Password
                      </label>
                      <Input.Password
                        size="small"
                        value={customAccountPassword}
                        onChange={(event) =>
                          setCustomAccountPassword(event.target.value)
                        }
                        placeholder="Password"
                      />
                    </div>
                  </div>
                ) : null}

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Start mode
                  </label>
                  <Select
                    value={startMode}
                    onChange={(value) =>
                      setStartMode(value as WindowsServiceStartMode)
                    }
                    className="w-full"
                    options={[
                      { label: "Automatic", value: "auto" },
                      { label: "Automatic (delayed)", value: "delayed-auto" },
                      { label: "Manual", value: "demand" },
                      { label: "Disabled", value: "disabled" },
                      { label: "Unchanged", value: "unchanged" },
                    ]}
                  />
                  <p className="mb-0 mt-1 text-xs text-slate-500">
                    When will the service start? Use Unchanged to keep the
                    current start mode.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    State
                  </label>
                  <Radio.Group
                    value={state}
                    onChange={(event) =>
                      setState(event.target.value as WindowsServiceState)
                    }
                    className="flex flex-col gap-2"
                  >
                    <Radio value="Default">
                      <span className="text-sm">
                        Default (based on start mode)
                      </span>
                    </Radio>
                    <Radio value="Started">
                      <span className="text-sm">Started</span>
                    </Radio>
                    <Radio value="Stopped">
                      <span className="text-sm">Stopped</span>
                    </Radio>
                    <Radio value="Unchanged">
                      <span className="text-sm">Unchanged</span>
                    </Radio>
                  </Radio.Group>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Dependencies
                  </label>
                  <Input
                    size="small"
                    value={dependencies}
                    onChange={(event) => setDependencies(event.target.value)}
                    placeholder="LanmanWorkstation/TCPIP/MSSQL"
                  />
                  <p className="mb-0 mt-1 text-xs text-slate-500">
                    Separate dependencies using forward slashes (/).
                  </p>
                </div>
              </div>
            </CollapsibleSection>
          </div>
        </CollapsibleSection>

        {enabledFeatures.has("Squid.Features.CustomScripts") ? (
          <CollapsibleSection
            title="Custom Deployment Scripts"
            subtitle="Configure scripts to run as part of this step."
            defaultOpen
            fullWidth
          >
            <div className="ml-[216px] space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Pre-deployment script
                </label>
                <Input.TextArea
                  value={customScriptsPreDeploy}
                  onChange={(event) =>
                    setCustomScriptsPreDeploy(event.target.value)
                  }
                  autoSize={{ minRows: 4, maxRows: 12 }}
                  placeholder="# Runs after extraction and before configuration"
                />
                <p className="mb-0 mt-1 text-xs text-slate-500">
                  This script will run after the package is extracted, but
                  before any configuration changes are made.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Post-deployment script
                </label>
                <Input.TextArea
                  value={customScriptsPostDeploy}
                  onChange={(event) =>
                    setCustomScriptsPostDeploy(event.target.value)
                  }
                  autoSize={{ minRows: 4, maxRows: 12 }}
                  placeholder="# Runs after service configuration completes"
                />
              </div>
            </div>
          </CollapsibleSection>
        ) : null}

        {enabledFeatures.has("Squid.Features.JsonConfigurationVariables") ? (
          <CollapsibleSection
            title="Structured Configuration Variables"
            subtitle="Replace settings in JSON, YAML, XML, and Java Properties files with variables defined in Squid."
            defaultOpen
            fullWidth
          >
            <div className="ml-[216px] space-y-4">
              <Checkbox
                checked={structuredConfigEnabled}
                onChange={(event) =>
                  setStructuredConfigEnabled(event.target.checked)
                }
              >
                <span className="text-sm">
                  Enable structured configuration variable replacement
                </span>
              </Checkbox>

              {structuredConfigEnabled ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Target files
                  </label>
                  <Input.TextArea
                    value={structuredConfigTargets}
                    onChange={(event) =>
                      setStructuredConfigTargets(event.target.value)
                    }
                    autoSize={{ minRows: 3, maxRows: 8 }}
                    placeholder={
                      "appsettings.json\nappsettings.Production.json"
                    }
                  />
                </div>
              ) : null}
            </div>
          </CollapsibleSection>
        ) : null}

        {enabledFeatures.has("Squid.Features.ConfigurationVariables") ? (
          <CollapsibleSection
            title=".NET Configuration Variables"
            subtitle="If set, replace appSettings and connectionString entries in any .config files."
            defaultOpen
          >
            <Checkbox
              checked={replaceConfigVariables}
              onChange={(event) =>
                setReplaceConfigVariables(event.target.checked)
              }
            >
              <span className="text-sm">Replace entries in .config files</span>
            </Checkbox>
            <p className="mb-0 mt-1 text-xs text-slate-500">
              Tentacle will scan <code>.config</code> files and replace matching
              keys using step variables.
            </p>
          </CollapsibleSection>
        ) : null}

        {enabledFeatures.has("Squid.Features.ConfigurationTransforms") ? (
          <CollapsibleSection
            title=".NET Configuration Transforms"
            subtitle="Configure .NET XML configuration transforms."
            defaultOpen
            fullWidth
          >
            <div className="ml-[216px] space-y-4">
              <div>
                <Checkbox
                  checked={runConfigTransforms}
                  onChange={(event) =>
                    setRunConfigTransforms(event.target.checked)
                  }
                >
                  <span className="text-sm">Run default XML transforms</span>
                </Checkbox>
                <p className="mb-0 mt-1 text-xs text-slate-500">
                  Squid looks for <em>*.Release.config</em> and{" "}
                  <em>*.&lt;EnvironmentName&gt;.config</em>.
                </p>
              </div>

              {runConfigTransforms ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Environment name token
                  </label>
                  <Input
                    size="small"
                    value={configTransformsEnvironmentName}
                    onChange={(event) =>
                      setConfigTransformsEnvironmentName(event.target.value)
                    }
                    placeholder="#{Squid.Environment.Name}"
                  />
                </div>
              ) : null}

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Additional transforms
                </label>
                <Input.TextArea
                  value={additionalTransforms}
                  onChange={(event) =>
                    setAdditionalTransforms(event.target.value)
                  }
                  autoSize={{ minRows: 3, maxRows: 8 }}
                  placeholder="Web.Release.config => Web.config"
                />
              </div>
            </div>
          </CollapsibleSection>
        ) : null}

        {enabledFeatures.has("Squid.Features.SubstituteInFiles") ? (
          <CollapsibleSection
            title="Substitute Variables in Templates"
            subtitle="Configure files to perform variable substitution on."
            defaultOpen
            fullWidth
          >
            <div className="ml-[216px] space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Target files
                </label>
                <Input.TextArea
                  value={substituteTemplatesTargetFiles}
                  onChange={(event) =>
                    setSubstituteTemplatesTargetFiles(event.target.value)
                  }
                  autoSize={{ minRows: 3, maxRows: 8 }}
                  placeholder={
                    "Notes.txt\nConfig\\*.json\n**\\specific-folder\\*.config"
                  }
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Output file encoding
                </label>
                <Input
                  size="small"
                  value={substituteTemplatesOutputEncoding}
                  onChange={(event) =>
                    setSubstituteTemplatesOutputEncoding(event.target.value)
                  }
                  placeholder="Detect from template"
                />
              </div>
            </div>
          </CollapsibleSection>
        ) : null}

        {enabledFeatures.has("Squid.Features.PowerShellEdition") ? (
          <CollapsibleSection
            title="PowerShell Edition"
            subtitle="Please select the PowerShell edition used during Windows deployments"
            defaultOpen
          >
            <Radio.Group
              value={powerShellEdition}
              onChange={(event) =>
                setPowerShellEdition(event.target.value as "Desktop" | "Core")
              }
              className="flex flex-col gap-2"
            >
              <Radio value="Desktop">
                <span className="text-sm">Windows PowerShell (Desktop)</span>
              </Radio>
              <Radio value="Core">
                <span className="text-sm">PowerShell Core</span>
              </Radio>
            </Radio.Group>
            <p className="mb-0 mt-1 text-xs text-slate-500">
              For non-Windows deployments PowerShell Core will be used.
            </p>
          </CollapsibleSection>
        ) : null}

        <CollapsibleSection
          title="Features"
          subtitle="Toggle Octopus-style feature surfaces on or off for this step."
          defaultOpen
          fullWidth
        >
          <div className="flex w-full flex-col items-center gap-2 py-2">
            <Button type="primary" onClick={openFeaturesModal}>
              Configure features
            </Button>
            <div className="max-w-[520px] text-center text-xs leading-relaxed text-slate-500">
              You can add or manage additional features used by this step.
            </div>
          </div>
        </CollapsibleSection>

        <Modal
          title="Enabled Features"
          open={featuresModalOpen}
          onCancel={closeFeaturesModal}
          onOk={saveFeatures}
          okText="OK"
          cancelText="Cancel"
          width={720}
        >
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="w-[44%] py-2 pr-4 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Feature
                </th>
                <th className="py-2 pl-4 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {WINDOWS_SERVICE_FEATURES.map((feature) => (
                <tr
                  key={feature.id}
                  className="border-b border-slate-100 last:border-b-0"
                >
                  <td className="py-3 pr-4 align-top">
                    <Checkbox
                      checked={featuresDraft.has(feature.id)}
                      onChange={(event) =>
                        toggleFeatureDraft(feature.id, event.target.checked)
                      }
                    >
                      <span className="text-sm text-slate-700">
                        {feature.name}
                      </span>
                    </Checkbox>
                  </td>
                  <td className="py-3 pl-4 align-top text-sm leading-relaxed text-slate-600">
                    {feature.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>

        <CollapsibleSection
          title="Conditions"
          subtitle="Configure when and where this step should run."
          defaultOpen
          fullWidth
        >
          <StepConditionsSection
            value={conditions}
            onChange={setConditions}
            projectId={projectId}
            hideRootSection
            hideChannels
            hidePackageRequirement
            hideDisabled
            afterEnvironments={
              <CollapsibleSection
                title="Rolling Deployment"
                subtitle="Configure a rolling deployment to control the number of deployment targets this step can deploy to at once."
                defaultOpen
              >
                <Checkbox
                  checked={maxParallelism > 0}
                  onChange={(event) =>
                    setMaxParallelism(
                      event.target.checked ? Math.max(maxParallelism, 1) : 0
                    )
                  }
                >
                  <span className="text-sm">
                    Configure a rolling deployment
                  </span>
                </Checkbox>
                {maxParallelism > 0 ? (
                  <div className="mt-2 max-w-[220px]">
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Maximum parallel targets
                    </label>
                    <Input
                      size="small"
                      type="number"
                      min={1}
                      value={String(maxParallelism)}
                      onChange={(event) => {
                        const parsed = Number.parseInt(event.target.value, 10);
                        if (!Number.isFinite(parsed) || parsed < 1) {
                          setMaxParallelism(1);
                          return;
                        }
                        setMaxParallelism(parsed);
                      }}
                    />
                  </div>
                ) : null}
              </CollapsibleSection>
            }
            afterRunCondition={
              <CollapsibleSection
                title="Start Trigger"
                subtitle="Control whether this step waits for the previous step to complete, or runs in parallel with it."
                defaultOpen
              >
                <Radio.Group
                  value={startTrigger}
                  onChange={(event) =>
                    setStartTrigger(event.target.value as StartTriggerMode)
                  }
                  className="flex flex-col gap-2"
                >
                  <Radio value="StartWithPrevious">
                    <span className="text-sm">
                      Run in parallel with the previous step
                    </span>
                  </Radio>
                  <Radio value="StartAfterPrevious">
                    <span className="text-sm">
                      Wait for all previous steps to complete, then start
                    </span>
                  </Radio>
                </Radio.Group>
              </CollapsibleSection>
            }
          />

          <CollapsibleSection
            title="Retries"
            subtitle="Upon failure, this step will automatically retry."
            defaultOpen
          >
            <Checkbox
              checked={retriesEnabled}
              onChange={(event) => setRetriesEnabled(event.target.checked)}
            >
              <span className="text-sm">Allow retries (max. 3)</span>
            </Checkbox>
            {retriesEnabled ? (
              <div className="max-w-[180px]">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Retries
                </label>
                <Input
                  size="small"
                  type="number"
                  min={1}
                  max={3}
                  value={String(retryCount)}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    if (!Number.isFinite(parsed)) {
                      setRetryCount(1);
                      return;
                    }
                    setRetryCount(Math.min(Math.max(parsed, 1), 3));
                  }}
                />
              </div>
            ) : null}
          </CollapsibleSection>

          <CollapsibleSection
            title="Time out"
            subtitle="If this step is still running after the set time has lapsed, the task will fail."
            defaultOpen
          >
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Time out after seconds (0 means never time out)
            </label>
            <Input
              size="small"
              type="number"
              min={0}
              value={String(stepTimeoutSeconds)}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10);
                if (!Number.isFinite(parsed) || parsed < 0) {
                  setStepTimeoutSeconds(0);
                  return;
                }
                setStepTimeoutSeconds(parsed);
              }}
            />
          </CollapsibleSection>
        </CollapsibleSection>
      </div>
    </div>
  );
});
