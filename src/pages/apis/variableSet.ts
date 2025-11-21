import { get } from 'utils/request'

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
  // 步骤作用域
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
  name: string
  description: string
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

export interface VariableSetItem {
  id: number;
  name: string;
  description?: string;
}

export function GetVariableSets(params?: GetVariableSetsRequest) {
  return get<GetVariableSetsResponseData>('/variableSet', { params })
}

export async function loadVariableSets(setLoading: React.Dispatch<React.SetStateAction<boolean>>) {
  try {
    setLoading(true);
    const res = await GetVariableSets({ pageIndex: 1, pageSize: 50 });
    const items: VariableSetItem[] = res.variableSets.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
    }));

    return items;
  } catch (error) {
    console.error('加载变量集失败', error);
  } finally {
    setLoading(false);
  }
  return [];
}