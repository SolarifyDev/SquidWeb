import { get, post } from 'utils/request'

export interface CertificateDto {
  id: number
  spaceId: number
  name: string
  notes: string
  certificateDataFormat: number
  passwordHasValue: boolean
  thumbprint: string
  subjectDistinguishedName: string
  subjectCommonName: string
  issuerDistinguishedName: string
  issuerCommonName: string
  selfSigned: boolean
  notAfter: string
  notBefore: string
  isExpired: boolean
  hasPrivateKey: boolean
  version: number
  serialNumber: string
  signatureAlgorithmName: string
  subjectAlternativeNames: string[]
  environmentIds: number[]
  archived?: string | null
  replacedBy?: number | null
  lastModifiedOn?: string | null
  lastModifiedBy?: string
}

export interface GetCertificatesRequest {
  pageIndex?: number
  pageSize?: number
}

export interface GetCertificatesResponseData {
  count: number
  certificates: CertificateDto[]
}

export function getCertificates(params?: GetCertificatesRequest) {
  const query = {
    pageIndex: params?.pageIndex ?? 1,
    pageSize: params?.pageSize ?? 1000,
  }

  return get<GetCertificatesResponseData>('/certificates/list', { params: query })
}

export interface CreateCertificateCommand {
  name: string
  commonName?: string | null
  notes: string
  certificateData?: string | null
  password?: string | null
  environmentIds: number[]
  spaceId: number
  keyType?: number
  validityDays?: number
  subjectAlternativeNames?: string[]
}

export function createCertificate(command: CreateCertificateCommand) {
  return post<{ certificate: CertificateDto }>('/certificates/create', command)
    .then((res) => res.certificate)
}

export interface DeleteCertificatesCommand {
  ids: number[]
}

export interface DeleteCertificatesResponseData {
  failIds: number[]
}

export function deleteCertificates(command: DeleteCertificatesCommand) {
  return post<DeleteCertificatesResponseData>('/certificates/delete', command)
}
