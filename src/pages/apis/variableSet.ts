import { get, post } from 'utils/request'

// 对应后端 VariableSetOwnerType 枚举
export enum VariableSetOwnerType {
  // 项目变量集
  Project = 1,
  // 库变量集
  LibraryVariableSet = 2,
  // 环境变量集
  Environment = 3,
}

// 对应后端 VariableType 枚举
export enum VariableType {
  // 字符串类型
  String = 1,
  // 数字类型
  Number = 2,
  // 布尔类型
  Boolean = 3,
  // 密码类型
  Password = 4,
  // 证书类型
  Certificate = 5,
  // 多行文本类型
  MultiLineText = 6,
  // 选择列表类型
  SelectList = 7,
}

// 对应后端 VariableScopeType 枚举
export enum VariableScopeType {
  // 环境作用域
  Environment = 1,
  // 机器作用域
  Machine = 2,
  // 角色作用域
  Role = 3,
  // 渠道作用域
  Channel = 4,
  // 部署步骤作用域
  Action = 5,
  // 兼容旧命名
  Step = 5,
  // 进程作用域
  Process = 6,
}

// 对应后端 VariableScopeDto
export interface VariableScopeDto {
  id: number
  variableId: number
  scopeType: VariableScopeType
  scopeValue: string
}

// 对应后端 VariableDto
export interface VariableDto {
  id: number
  variableSetId: number
  name: string
  value: string
  description: string
  type: VariableType
  isSensitive: boolean
  sortOrder: number
  lastModifiedOn: string | null
  lastModifiedBy: string
  scopes: VariableScopeDto[]
}

// 对应 VariableSetDto
export interface VariableSetDto {
  id: number
  Name?: string
  Description?: string
  Variables?: VariableDto[]
  name?: string
  description?: string
  ownerType: VariableSetOwnerType
  ownerId: number
  version: number
  relatedDocumentIds: string
  lastModified: string | null
  spaceId: number
  variables: VariableDto[]
}

// 对应 GetVariableSetsRequest（分页查询请求）
export interface GetVariableSetsRequest {
  pageIndex?: number
  pageSize?: number
  ownerType?: VariableSetOwnerType
  ownerId?: number
  spaceId?: number
  keyword?: string
}

// 对应 GetVariableSetsResponseData
export interface GetVariableSetsResponseData {
  count: number
  variableSets: VariableSetDto[]
}

export interface GetVariableSetResponseData {
  variableSet: VariableSetDto
}

export interface CreateVariableSetCommand {
  ownerId: number
  ownerType: VariableSetOwnerType
  spaceId: number
  Name: string
  Description: string
  variables: VariableDto[]
}

export interface CreateVariableSetResponseData {
  variableSet: VariableSetDto
}

export interface UpdateVariableSetCommand {
  id: number
  ownerId: number
  ownerType: VariableSetOwnerType
  spaceId: number
  Name: string
  Description: string
  variables: VariableDto[]
}

export interface UpdateVariableSetResponseData {
  variableSet: VariableSetDto
}

export interface VariableSetItem {
  id: number
  ownerId: number
  ownerType: VariableSetOwnerType
  name: string
  description?: string
}

export function GetVariableSets(params?: GetVariableSetsRequest) {
  const query = {
    pageIndex: params?.pageIndex ?? 1,
    pageSize: params?.pageSize ?? 1000,
    ...(params?.ownerType ? { ownerType: params.ownerType } : {}),
    ...(params?.ownerId ? { ownerId: params.ownerId } : {}),
    ...(params?.spaceId ? { spaceId: params.spaceId } : {}),
    ...(params?.keyword ? { keyword: params.keyword } : {}),
  }

  return get<GetVariableSetsResponseData>('/variable-sets/list', { params: query })
}

export function GetVariableSet(id: number) {
  return get<GetVariableSetResponseData>(`/variable-sets/detail/${id}`)
    .then((res) => normalizeVariableSet(res.variableSet))
}

export function CreateVariableSet(command: CreateVariableSetCommand) {
  return post<CreateVariableSetResponseData>('/variable-sets/create', command)
    .then((res) => normalizeVariableSet(res.variableSet))
}

export function UpdateVariableSet(command: UpdateVariableSetCommand) {
  return post<UpdateVariableSetResponseData>('/variable-sets/update', command)
    .then((res) => normalizeVariableSet(res.variableSet))
}

function resolveVariableSetName(variableSet: Pick<VariableSetDto, 'name' | 'Name'>): string {
  return (variableSet.name ?? variableSet.Name ?? '').trim()
}

function resolveVariableSetDescription(variableSet: Pick<VariableSetDto, 'description' | 'Description'>): string {
  return (variableSet.description ?? variableSet.Description ?? '').trim()
}

function normalizeVariableSet(variableSet: VariableSetDto): VariableSetDto {
  const name = resolveVariableSetName(variableSet)
  const description = resolveVariableSetDescription(variableSet)
  const rawVariables = Array.isArray(variableSet.variables)
    ? variableSet.variables
    : Array.isArray(variableSet.Variables)
      ? variableSet.Variables
      : []
  const variables = rawVariables.map((variable, index) => normalizeVariable(variable, variableSet.id, index))

  return {
    ...variableSet,
    name,
    description,
    variables,
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function normalizeVariableType(value: unknown): VariableType {
  const fromNumber = toNumber(value)
  if (fromNumber && VariableType[fromNumber as VariableType] !== undefined) {
    return fromNumber as VariableType
  }

  if (typeof value === 'string') {
    const fromName = VariableType[value as keyof typeof VariableType]
    if (typeof fromName === 'number') return fromName as VariableType
  }

  return VariableType.String
}

function normalizeScopeType(value: unknown): VariableScopeType {
  const fromNumber = toNumber(value)
  if (fromNumber && VariableScopeType[fromNumber as VariableScopeType] !== undefined) {
    return fromNumber as VariableScopeType
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'environment') return VariableScopeType.Environment
    if (normalized === 'machine') return VariableScopeType.Machine
    if (normalized === 'role') return VariableScopeType.Role
    if (normalized === 'channel') return VariableScopeType.Channel
    if (normalized === 'action' || normalized === 'step') return VariableScopeType.Action
    if (normalized === 'process') return VariableScopeType.Process

    const fromName = VariableScopeType[value as keyof typeof VariableScopeType]
    if (typeof fromName === 'number') return fromName as VariableScopeType
  }

  return VariableScopeType.Environment
}

function normalizeVariableScope(scope: any, variableId: number): VariableScopeDto {
  return {
    id: toNumber(scope?.id ?? scope?.Id) ?? 0,
    variableId: toNumber(scope?.variableId ?? scope?.VariableId) ?? variableId,
    scopeType: normalizeScopeType(scope?.scopeType ?? scope?.ScopeType),
    scopeValue: String(scope?.scopeValue ?? scope?.ScopeValue ?? '').trim(),
  }
}

function normalizeVariable(variable: any, variableSetId: number, index: number): VariableDto {
  const id = toNumber(variable?.id ?? variable?.Id) ?? 0
  const rawScopes = Array.isArray(variable?.scopes)
    ? variable.scopes
    : Array.isArray(variable?.Scopes)
      ? variable.Scopes
      : []

  return {
    id,
    variableSetId: toNumber(variable?.variableSetId ?? variable?.VariableSetId) ?? variableSetId,
    name: String(variable?.name ?? variable?.Name ?? '').trim(),
    value: String(variable?.value ?? variable?.Value ?? ''),
    description: String(variable?.description ?? variable?.Description ?? ''),
    type: normalizeVariableType(variable?.type ?? variable?.Type),
    isSensitive: Boolean(variable?.isSensitive ?? variable?.IsSensitive),
    sortOrder: toNumber(variable?.sortOrder ?? variable?.SortOrder) ?? index,
    lastModifiedOn: (variable?.lastModifiedOn ?? variable?.LastModifiedOn ?? null) as string | null,
    lastModifiedBy: String(variable?.lastModifiedBy ?? variable?.LastModifiedBy ?? ''),
    scopes: rawScopes.map((scope: any) => normalizeVariableScope(scope, id)),
  }
}

export function getVariableSetDisplayName(variableSet: Pick<VariableSetDto, 'id' | 'ownerId' | 'name' | 'Name'>): string {
  const explicitName = resolveVariableSetName(variableSet)
  if (explicitName) {
    return explicitName
  }
  return `LibraryVariableSet-${variableSet.ownerId || variableSet.id}`
}

export function getVariableSetDescription(variableSet: Pick<VariableSetDto, 'description' | 'Description'>): string {
  return resolveVariableSetDescription(variableSet)
}

// Octopus-style route id for variable sets, e.g. "LibraryVariableSets-121" —
// clearer in the URL than a bare number. parseVariableSetId reads the trailing
// digits back out, so the detail route accepts both forms.
export const LIBRARY_VARIABLE_SET_ID_PREFIX = 'LibraryVariableSets-'

export function formatVariableSetRouteId(id: number | string): string {
  return `${LIBRARY_VARIABLE_SET_ID_PREFIX}${id}`
}

export async function loadVariableSets(
  setLoading: React.Dispatch<React.SetStateAction<boolean>>,
  spaceId?: number,
  keyword?: string,
) {
  try {
    setLoading(true)
    const res = await GetVariableSets({
      pageIndex: 1,
      pageSize: 1000,
      spaceId,
      keyword,
      ownerType: VariableSetOwnerType.LibraryVariableSet,
    })
    const items: VariableSetItem[] = res.variableSets.map((raw) => {
      const item = normalizeVariableSet(raw)
      return {
      id: item.id,
      ownerId: item.ownerId,
      ownerType: item.ownerType,
      name: getVariableSetDisplayName(item),
      description: getVariableSetDescription(item),
      }
    })

    return items
  } catch (error) {
    console.error('Failed to load variable sets', error)
  } finally {
    setLoading(false)
  }
  return []
}
