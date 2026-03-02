import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Spin } from 'antd'
import { FilterOutlined, MoreOutlined } from '@ant-design/icons'
import { getProjects } from 'pages/apis/project'
import { getLifecycles, LifecycleDto } from 'pages/apis/lifecycle'
import { getProjectProgression } from 'pages/apis/projectProgression'
import {
  getDeploymentSteps,
  DeploymentStepDto,
} from 'pages/apis/deploymentProcess'
import { KubernetesContainersEditor, type KubernetesContainersEditorHandle } from './step-editors/kubernetes-containers/KubernetesContainersEditor'
import { KubernetesIngressEditor } from './step-editors/kubernetes-ingress/KubernetesIngressEditor'
import { KubernetesServiceEditor } from './step-editors/kubernetes-service/KubernetesServiceEditor'
import { KubernetesConfigMapEditor } from './step-editors/kubernetes-configmap/KubernetesConfigMapEditor'
import { KubernetesSecretEditor } from './step-editors/kubernetes-secret/KubernetesSecretEditor'
import type { StepEditorHandle, StepEditorProps } from './step-editors/shared/StepEditorTypes'

// ── Step editor registry ───────────────────────────────────────────────────────

type StepEditorComponent = React.ForwardRefExoticComponent<StepEditorProps & React.RefAttributes<StepEditorHandle>>

const STEP_EDITOR_MAP: Record<string, StepEditorComponent> = {
  'Squid.KubernetesDeployContainers': KubernetesContainersEditor as StepEditorComponent,
  'Squid.KubernetesDeployIngress':    KubernetesIngressEditor,
  'Squid.KubernetesDeployService':    KubernetesServiceEditor,
  'Squid.KubernetesDeployConfigMap':  KubernetesConfigMapEditor,
  'Squid.KubernetesDeploySecret':     KubernetesSecretEditor,
}

// ── API base for image URLs ────────────────────────────────────────────────────

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL ?? 'https://localhost:7078/api'

function stepLogoUrl(spaceId: string, actionType: string) {
  return `${API_BASE}/${spaceId}/actiontemplates/${actionType}/logo`
}

// ── Action type → summary ─────────────────────────────────────────────────────

function actionSummary(actionType: string): string {
  const map: Record<string, string> = {
    'Squid.Manual': 'Manual intervention required',
    'Squid.Script': 'Run a script',
    'Squid.KubernetesDeployContainers': 'Deploy containers to Kubernetes',
    'Squid.KubernetesDeployRawYaml': 'Deploy Kubernetes YAML',
    'Squid.HelmChartUpgrade': 'Deploy a Helm Chart',
    'Squid.Kubernetes.Kustomize': 'Deploy with Kustomize',
    'Squid.IIS': 'Deploy to IIS',
    'Squid.TentaclePackage': 'Deploy a Package',
    'Squid.AzureAppService': 'Deploy an Azure App Service',
    'Squid.AzurePowerShell': 'Run an Azure Script',
    'Squid.AwsRunScript': 'Run an AWS CLI Script',
  }
  return map[actionType] ?? actionType.replace(/^Squid\./, '')
}

// ── Category SVG icons ────────────────────────────────────────────────────────

function FeaturedSvg() {
  return (
    <svg fill="currentColor" viewBox="0 0 20 20" width="28" height="28">
      <path d="M10.8815 2.56202C10.7252 2.21856 10.3814 2 10.0063 2C9.59995 2 9.25612 2.21856 9.09984 2.56202L7.09938 6.71469L2.59835 7.37038C2.22327 7.43283 1.9107 7.68261 1.78567 8.05729C1.6919 8.40074 1.78567 8.80664 2.03573 9.05643L5.28647 12.2724L4.5363 16.831C4.47378 17.2057 4.63007 17.5803 4.94264 17.7989C5.25521 18.0487 5.66155 18.0487 5.97412 17.8926L10.0063 15.7382L14.0072 17.8926C14.351 18.0487 14.7574 18.0487 15.07 17.7989C15.3825 17.5803 15.5388 17.2057 15.4763 16.831L14.6949 12.2724L17.9456 9.05643C18.2269 8.80664 18.3207 8.40074 18.1957 8.05729C18.0706 7.68261 17.7581 7.43283 17.383 7.37038L12.9132 6.71469L10.8815 2.56202Z" />
    </svg>
  )
}

function ScriptSvg() {
  return (
    <svg fill="currentColor" viewBox="0 0 20 20" width="28" height="28">
      <path d="M1 4.5V6C1 6.5625 1.4375 7 2 7H2.5H4V4.5C4 3.6875 3.3125 3 2.5 3C1.65625 3 1 3.6875 1 4.5ZM4.5 3C4.8125 3.4375 5 3.9375 5 4.5V14C5 15.125 5.875 16 7 16C8.09375 16 9 15.125 9 14V13.8438C9 12.8438 9.8125 12 10.8125 12H16V6C16 4.34375 14.6562 3 13 3H4.5ZM15.5 17C17.4062 17 19 15.4375 19 13.5C19 13.25 18.75 13 18.5 13H10.8125C10.375 13 10 13.375 10 13.8438V14C10 15.6562 8.65625 17 7 17H12.5H15.5Z" />
    </svg>
  )
}

function PackageSvg() {
  return (
    <svg fill="currentColor" viewBox="0 0 20 20" width="28" height="28">
      <path d="M4.5625 3.84375L3 7H9.5V3H5.90625C5.34375 3 4.8125 3.34375 4.5625 3.84375ZM10.5 7H17L15.4062 3.84375C15.1562 3.34375 14.625 3 14.0625 3H10.5V7ZM17 8H3V15C3 16.125 3.875 17 5 17H15C16.0938 17 17 16.125 17 15V8Z" />
    </svg>
  )
}

function KubernetesSvg() {
  return (
    <svg fill="currentColor" viewBox="0 0 70 70" width="28" height="28">
      <path d="M48.55018,45.18094 C47.30453,47.17384 45.56083,48.91789 43.56793,50.16354 L40.32903,42.35749 C40.16278,41.69319 40.49493,41.02854 41.07628,40.77934 C41.32548,40.69639 41.57433,40.61344 41.82353,40.61344 L50.12833,42.02499 C49.71288,43.18769 49.21448,44.26744 48.55018,45.18094 Z M38.41908,52.40564 C37.25603,52.65484 36.09368,52.82109 34.84803,52.82109 C33.10398,52.82109 31.27698,52.48859 29.61623,51.99054 L33.68533,44.59959 C34.10078,44.10154 34.76473,43.93529 35.34608,44.26744 C35.59528,44.43334 35.76153,44.59959 36.01073,44.84879 L39.99688,52.07349 C39.49848,52.15644 39.00043,52.23939 38.41908,52.40564 Z M19.56773,42.10829 L27.78958,40.69639 C28.45353,40.69639 29.11783,41.11184 29.20113,41.77614 C29.28408,42.02499 29.28408,42.35749 29.11783,42.60669 L25.96223,50.24649 C23.05583,48.33654 20.73078,45.42979 19.56773,42.10829 Z M20.97998,28.07399 L27.12493,33.55464 C27.70628,34.05304 27.78958,34.88359 27.29118,35.46459 C27.12493,35.71379 26.95903,35.79674 26.62653,35.88004 L18.57163,38.20509 C18.32243,34.71734 19.15263,31.14629 20.97998,28.07399 Z M31.11108,20.76599 L32.77183,20.43349 L32.35673,28.73829 C32.35673,29.48554 31.69243,30.06689 30.94483,30.06689 C30.69563,30.06689 30.52973,29.98394 30.28053,29.90064 L23.38763,25.00099 C25.54713,22.92514 28.20433,21.43029 31.11108,20.76599 Z M46.14183,25.00099 L39.33223,29.81769 C38.75123,30.14984 37.92068,30.06689 37.50523,29.48554 C37.33933,29.31964 37.25603,29.15339 37.25603,28.90419 L36.75833,20.51679 C40.41198,20.93189 43.65088,22.51004 46.14183,25.00099 Z M50.62638,32.97329 C51.04148,34.71734 51.12443,36.46104 50.95853,38.20509 L43.06953,35.96299 C42.32193,35.79674 41.90683,35.04949 42.07273,34.30189 C42.15568,34.05304 42.23898,33.88679 42.40488,33.72089 L48.63313,28.07399 C49.54698,29.56849 50.21128,31.22959 50.62638,32.97329 Z M37.09013,38.37134 L34.84803,39.45074 L32.60558,38.37134 L32.02458,35.96299 L33.60238,33.96974 L36.09368,33.96974 L37.67148,35.96299 L37.09013,38.37134 Z" />
    </svg>
  )
}

function DockerSvg() {
  return (
    <svg fill="currentColor" viewBox="0 0 70 70" width="28" height="28">
      <path d="M59.5182,31.490375 L60.5402,32.172875 L60.36625,32.533025 C60.0488,33.191025 59.9396,33.399625 59.89305,33.479075 C58.07585,36.950025 54.537,36.973825 52.8962,36.940575 C48.71895,47.029325 39.7985,52.579625 27.7417,52.579625 C22.1795,52.579625 17.9186,50.873725 15.0759,47.509175 C11.33685,43.082375 11.32985,37.322775 11.6431,35.477225 L11.70785,35.093975 L44.99705,35.093975 C46.73445,35.128625 48.04065,34.635825 48.7053,34.278125 C48.0403,33.262425 47.8282,32.106725 47.7603,31.460625 C47.6105,29.624175 48.0683,27.708975 48.98495,26.327175 L49.70105,25.253025 L50.77415,25.968425 C52.64035,27.411475 53.6669,29.008175 53.9182,30.848825 C55.87365,30.480275 58.41255,30.751175 59.5182,31.490375 Z M33.2633,23.1301 L33.2633,18.52865 L38.325,18.52865 L38.325,23.1301 L33.2633,23.1301 Z M33.2633,28.65205 L33.2633,24.0506 L38.325,24.0506 L38.325,28.65205 L33.2633,28.65205 Z M27.28145,28.65205 L27.28145,24.0506 L32.34315,24.0506 L32.34315,28.65205 L27.28145,28.65205 Z M21.2996,28.65205 L21.2996,24.0506 L26.3613,24.0506 L26.3613,28.65205 L21.2996,28.65205 Z M15.31775,34.17365 L15.31775,29.5722 L20.37945,29.5722 L20.37945,34.17365 L15.31775,34.17365 Z M21.2996,34.17365 L21.2996,29.5722 L26.3613,29.5722 L26.3613,34.17365 L21.2996,34.17365 Z M27.28145,34.17365 L27.28145,29.5722 L32.34315,29.5722 L32.34315,34.17365 L27.28145,34.17365 Z M33.2633,34.17365 L33.2633,29.5722 L38.325,29.5722 L38.325,34.17365 L33.2633,34.17365 Z M39.24515,34.17365 L39.24515,29.5722 L44.30685,29.5722 L44.30685,34.17365 L39.24515,34.17365 Z" />
    </svg>
  )
}

function TerraformSvg() {
  return (
    <svg fill="currentColor" viewBox="0 0 70 70" width="28" height="28">
      <path d="M43.284465,26.948635 L56.641515,19.227635 L56.641515,34.661585 L43.284465,42.366485 L43.284465,26.948635 Z M28.46144,19.2276 L41.81849,26.9486 L41.81849,42.36645 L28.46144,34.6535 L28.46144,19.2276 Z M28.46144,51.77333 L28.46144,36.34743 L41.81849,44.06038 L41.81849,59.48628 L28.46144,51.77333 Z M13.63824,10.61893 L26.99564,18.33188 L26.99564,33.75743 L13.63824,26.04483 L13.63824,10.61893 Z" />
    </svg>
  )
}

function AwsSvg() {
  return (
    <svg fill="currentColor" viewBox="0 0 21 20" width="28" height="28">
      <path d="M6.625 8.37506C6.59375 9.06256 6.96875 9.37506 6.96875 9.59381C6.96875 9.65631 6.90625 9.75006 6.84375 9.78131L6.4375 10.0626C6.375 10.0938 6.3125 10.1251 6.25 10.1251C6.25 10.1251 6 10.1876 5.625 9.31256C5.15625 9.90631 4.40625 10.2501 3.65625 10.2501C3.15625 10.2501 1.78125 9.93756 1.84375 8.46881C1.78125 7.28131 2.90625 6.53131 4.0625 6.59381C4.28125 6.59381 4.75 6.62506 5.53125 6.81256V6.31256C5.625 5.46881 5.0625 4.84381 4.125 4.93756C4.0625 4.93756 3.53125 4.93756 2.6875 5.25006C2.46875 5.37506 2.4375 5.34381 2.375 5.34381C2.125 5.34381 2.21875 4.65631 2.28125 4.59381C2.4375 4.37506 3.375 4.00006 4.34375 4.03131C4.96875 3.96881 5.59375 4.15631 6.0625 4.56256C6.46875 5.00006 6.65625 5.59381 6.625 6.18756V8.37506ZM3.90625 9.37506C4.9375 9.34381 5.375 8.75006 5.46875 8.40631C5.53125 8.09381 5.53125 7.90631 5.53125 7.56256C5.21875 7.50006 4.78125 7.40631 4.28125 7.40631C3.8125 7.37506 2.9375 7.59381 3 8.40631C2.9375 8.93756 3.34375 9.40631 3.90625 9.37506ZM9.25 10.0938C9.03125 10.1251 8.90625 9.93756 8.875 9.78131L7.3125 4.62506C7.28125 4.53131 7.25 4.43756 7.25 4.34381C7.25 4.28131 7.28125 4.18756 7.375 4.18756C7.375 4.18756 7.3125 4.18756 8.0625 4.18756C8.34375 4.15631 8.4375 4.37506 8.46875 4.50006L9.5625 8.90631L10.625 4.50006C10.625 4.40631 10.6875 4.15631 11 4.18756H11.5625C11.625 4.18756 11.9062 4.18756 11.9375 4.53131L13 8.96881L14.125 4.53131C14.1562 4.43756 14.2187 4.15631 14.5312 4.18756H15.1562C15.1875 4.18756 15.3437 4.15631 15.3125 4.46881C15.3125 4.53131 15.4375 4.12506 13.6562 9.78131C13.625 9.93756 13.5312 10.1251 13.2812 10.0938H12.6875C12.3437 10.1251 12.3125 9.78131 12.2812 9.75006L11.25 5.46881L10.2187 9.75006C10.2187 9.78131 10.1875 10.1251 9.84375 10.0938H9.25ZM17.8125 10.2813C17.625 10.2813 16.75 10.2501 16.0312 9.87506C15.875 9.81256 15.7812 9.68756 15.7812 9.50006V9.18756C15.7812 8.90631 15.9687 8.96881 16.0625 9.00006C16.375 9.12506 16.5625 9.21881 16.9375 9.28131C18.0938 9.53131 18.5937 9.21881 18.7187 9.15631C19.125 8.90631 19.1562 8.34381 18.875 8.06256C18.5625 7.78131 18.4062 7.78131 17.2187 7.40631C17.0937 7.37506 15.875 6.96881 15.8437 5.78131C15.8437 4.87506 16.625 4.00006 18.0312 4.03131C18.4375 4.03131 19.4687 4.15631 19.7812 4.50006C19.8125 4.56256 19.8437 4.65631 19.8125 4.71881V5.03131C19.8125 5.18756 19.7812 5.25006 19.6875 5.25006C19.4375 5.21881 19 4.90631 18.125 4.90631C17.9375 4.90631 16.9062 4.93756 16.9375 5.68756C16.9375 6.28131 17.7812 6.50006 17.875 6.53131C19 6.87506 19.375 6.93756 19.8437 7.46881C20.375 8.15631 20.0937 8.96881 19.9687 9.18756C19.375 10.3751 17.8437 10.2813 17.8125 10.2813ZM19.0625 13.5313C16.875 15.1563 13.6875 16.0313 11 16.0313C7.3125 16.0313 3.78125 14.6876 1.0625 12.2501C0.874999 12.0626 1.0625 11.8126 1.3125 11.9376C4.3125 13.6876 7.71875 14.5938 11.1875 14.5938C13.7812 14.5626 16.3437 14.0313 18.75 13.0313C19.125 12.8751 19.4375 13.2813 19.0625 13.5313ZM19.9687 12.5001C19.6875 12.1563 18.125 12.3438 17.4062 12.4063C17.2187 12.4376 17.1875 12.2501 17.375 12.1251C18.625 11.2501 20.6875 11.5001 20.9062 11.7813C21.1562 12.0938 20.8437 14.1563 19.6875 15.1251C19.5 15.2813 19.3125 15.2188 19.4062 15.0001C19.6562 14.3438 20.25 12.8751 19.9687 12.5001Z" />
    </svg>
  )
}

function AzureSvg() {
  return (
    <svg fill="currentColor" viewBox="0 0 20 20" width="28" height="28">
      <path fillRule="evenodd" clipRule="evenodd" d="M13.3863 2.15011C13.5223 2.24774 13.6242 2.38557 13.6777 2.54418L18.5376 16.9439C18.5782 17.0642 18.5896 17.1925 18.5708 17.3181C18.552 17.4437 18.5036 17.563 18.4295 17.6662C18.3555 17.7694 18.2579 17.8535 18.1449 17.9115C18.0319 17.9695 17.9068 17.9998 17.7797 17.9998H12.1797C12.1854 17.9998 12.1912 17.9997 12.197 17.9996H12.0087C11.8208 17.9981 11.6391 17.9318 11.4943 17.812L8.03811 14.5884L7.07054 17.44C7.0202 17.5832 6.93276 17.7104 6.81715 17.8087C6.70154 17.9071 6.5619 17.9729 6.4125 17.9996H2.40117C2.27286 18 2.14636 17.9694 2.03237 17.9105C1.91837 17.8516 1.82023 17.7662 1.74626 17.6613C1.67228 17.5565 1.62464 17.4354 1.60737 17.3083C1.5901 17.1811 1.6037 17.0517 1.64703 16.9309L6.49895 2.55558C6.54995 2.39393 6.6513 2.25282 6.78819 2.15287C6.92508 2.05292 7.09035 1.99936 7.25985 2.00001H7.32284C7.32184 2 7.32083 2 7.31982 2H12.9197C13.0871 1.99998 13.2503 2.05248 13.3863 2.15011ZM11.3929 12.3667L10.0926 8.514L8.7853 12.3673L11.3929 12.3667Z" />
    </svg>
  )
}

function GcpSvg() {
  return (
    <svg fill="currentColor" viewBox="0 0 70 70" width="28" height="28">
      <path d="M41.7272 26.0806H43.2522L47.5985 21.7343L47.812 19.8891C45.3222 17.6915 42.3132 16.1649 39.0694 15.4535C35.8255 14.7421 32.4538 14.8694 29.2728 15.8234C26.0919 16.7774 23.2066 18.5265 20.8896 20.9057C18.5726 23.2848 16.9003 26.2153 16.0308 29.4204C16.515 29.2219 17.0513 29.1898 17.5558 29.3289L26.2483 27.8954C26.2483 27.8954 26.6906 27.1634 26.9194 27.2091C28.7819 25.1636 31.3559 23.9073 34.1144 23.6975C36.8729 23.4877 39.6073 24.3403 41.7577 26.0806H41.7272Z" />
      <path d="M53.7901 29.4204C52.791 25.7415 50.7399 22.4342 47.8883 19.9043L41.7882 26.0043C43.0595 27.0431 44.0783 28.357 44.7678 29.847C45.4573 31.3369 45.7995 32.964 45.7685 34.6054V35.6882C46.4814 35.6882 47.1874 35.8286 47.8461 36.1014C48.5048 36.3743 49.1033 36.7742 49.6074 37.2783C50.1115 37.7824 50.5114 38.3809 50.7843 39.0396C51.0571 39.6983 51.1975 40.4043 51.1975 41.1172C51.1975 41.8302 51.0571 42.5362 50.7843 43.1948C50.5114 43.8535 50.1115 44.452 49.6074 44.9561C49.1033 45.4603 48.5048 45.8602 47.8461 46.133C47.1874 46.4058 46.4814 46.5463 45.7685 46.5463H34.9104L33.8276 47.6443V54.1561L34.9104 55.2388H45.7685C48.8006 55.2625 51.7597 54.3095 54.2082 52.5209C56.6567 50.7324 58.4645 48.2032 59.3642 45.3076C60.2638 42.4119 60.2075 39.3036 59.2037 36.4424C58.1998 33.5812 56.3017 31.1192 53.7901 29.4204Z" />
      <path d="M24.0375 55.1786H34.8956V46.4861H24.0375C23.2639 46.4859 22.4994 46.3195 21.7957 45.998L20.2707 46.4708L15.8939 50.8171L15.5127 52.3421C17.9671 54.1955 20.962 55.192 24.0375 55.1786Z" />
      <path d="M24.0373 26.9806C21.0952 26.9981 18.2322 27.9341 15.8479 29.6579C13.4637 31.3816 11.6774 33.807 10.7384 36.5952C9.79952 39.3834 9.75488 42.3953 10.6108 45.2101C11.4667 48.0249 13.1803 50.5022 15.5124 52.2958L21.8107 45.9975C21.0104 45.6359 20.3097 45.0855 19.7688 44.3935C19.2279 43.7016 18.8629 42.8887 18.7052 42.0247C18.5475 41.1607 18.6018 40.2713 18.8634 39.4329C19.125 38.5945 19.5861 37.8321 20.2071 37.211C20.8281 36.59 21.5906 36.1289 22.429 35.8673C23.2674 35.6057 24.1568 35.5514 25.0208 35.7091C25.8848 35.8668 26.6977 36.2318 27.3896 36.7727C28.0816 37.3136 28.6319 38.0143 28.9936 38.8147L35.2919 32.5164C33.9699 30.7881 32.2661 29.3892 30.3137 28.4288C28.3612 27.4685 26.2131 26.9728 24.0373 26.9806Z" />
    </svg>
  )
}

function WindowsSvg() {
  return (
    <svg fill="currentColor" viewBox="0 0 70 70" width="28" height="28">
      <path d="M59.158015,36.1774 L59.303265,58.9694 L32.953865,55.5212 L32.832065,36.34505 L59.158015,36.1774 Z M32.692765,14.5096 L58.995965,10.72295 L59.142615,33.7344 L32.816315,33.90205 L32.692765,14.5096 Z M30.643515,36.35905 L30.763915,55.2349 L10.964415,52.6456 L10.860115,36.48575 L30.643515,36.35975 Z M10.739015,17.66905 L30.506315,14.82355 L30.627765,33.9157 L10.844715,34.0417 L10.739015,17.66905 Z" />
    </svg>
  )
}

function CertificateSvg() {
  return (
    <svg fill="currentColor" viewBox="0 0 20 20" width="28" height="28">
      <path d="M6.01728 3.99846C6.01728 2.90555 6.89102 2 8.0144 2H13.0072V5.99693C13.0072 6.55899 13.4441 6.99616 14.0058 6.99616H18V15.9892C18 17.1134 17.0951 17.9877 16.0029 17.9877H8.91935C8.98176 17.8316 9.01296 17.6754 9.01296 17.4881V14.99C9.04417 14.99 9.07537 14.9588 9.10658 14.9588C9.32501 14.8651 9.57465 14.709 9.76188 14.4592C9.94911 14.2406 10.0739 13.9283 10.1051 13.6161C10.1363 13.5224 10.1363 13.4599 10.1363 13.3975C10.1988 13.3663 10.23 13.335 10.3236 13.2726C10.9477 12.773 11.1661 11.9611 10.8853 11.2117C10.8229 11.118 10.7916 11.0555 10.7916 11.0243C10.7916 10.9619 10.8229 10.8994 10.8853 10.8057C11.1661 10.0875 10.9477 9.24443 10.3236 8.74481C10.23 8.68236 10.1988 8.65113 10.1363 8.61991C10.1363 8.55746 10.1363 8.495 10.1051 8.40133C10.0115 7.62068 9.38742 6.99616 8.6073 6.90248C8.51368 6.87125 8.45127 6.87125 8.38886 6.87125C8.35766 6.84003 8.32645 6.77758 8.26404 6.6839C7.76476 6.05938 6.95343 5.8408 6.20451 6.15306C6.1421 6.18428 6.04849 6.21551 6.01728 6.24673V3.99846ZM18 5.99693H14.0058V2L18 5.99693ZM5.42439 7.05861L5.92367 7.24596C5.95487 7.27719 6.04849 7.27719 6.1109 7.24596L6.57897 7.05861C6.89102 6.9337 7.26548 7.02738 7.48392 7.27719L7.79597 7.71435C7.82717 7.77681 7.88958 7.80803 7.95199 7.80803L8.48248 7.87048C8.82573 7.93294 9.07537 8.18274 9.13778 8.52623L9.20019 9.05707C9.20019 9.11952 9.2314 9.18198 9.29381 9.2132L9.69947 9.52546C9.98032 9.74404 10.0739 10.0875 9.94911 10.3998L9.76188 10.8994C9.73068 10.9619 9.73068 11.0555 9.76188 11.118L9.94911 11.5864C10.0739 11.8986 9.98032 12.2733 9.73068 12.4607L9.29381 12.8042C9.2314 12.8354 9.20019 12.8979 9.20019 12.9603L9.13778 13.4912C9.07537 13.8346 8.82573 14.0845 8.48248 14.1469L8.0144 14.2094V17.4881C8.0144 17.6754 7.88958 17.8628 7.73356 17.9565C7.57753 18.0189 7.3903 18.0189 7.23428 17.9252L6.01728 17.1134L4.76908 17.9252C4.64426 18.0189 4.42583 18.0189 4.2698 17.9565C4.11378 17.8628 4.02016 17.6754 4.02016 17.4881V14.2094L3.52088 14.1469C3.17763 14.0845 2.92799 13.8346 2.89678 13.4912L2.80317 12.9603C2.80317 12.8979 2.77196 12.8354 2.70955 12.8042L2.30389 12.4607C2.02304 12.2733 1.92943 11.8986 2.05425 11.5864L2.27268 11.0868C2.27268 11.0555 2.27268 10.9619 2.27268 10.8994L2.05425 10.431C1.92943 10.1188 2.02304 9.74404 2.30389 9.52546L2.70955 9.2132C2.77196 9.18198 2.80317 9.11952 2.80317 9.05707L2.86558 8.52623C2.92799 8.18274 3.17763 7.93294 3.52088 7.87048L4.05137 7.80803C4.11378 7.80803 4.17619 7.77681 4.20739 7.71435L4.51944 7.30842C4.73788 7.02738 5.11234 6.9337 5.42439 7.05861ZM8.0144 10.9931C8.0144 9.90017 7.10946 8.99462 6.01728 8.99462C4.8939 8.99462 4.02016 9.90017 4.02016 10.9931C4.02016 12.1172 4.8939 12.9915 6.01728 12.9915C7.10946 12.9915 8.0144 12.1172 8.0144 10.9931Z" />
    </svg>
  )
}

function CommunitySvg() {
  return (
    <svg fill="#1A77CA" viewBox="0 0 70 70" width="28" height="28">
      <path d="M25.8912008,35.9285523 C23.2795905,36.0038872 20.9190966,37.1339108 19.236617,39.1428418 L15.8716576,39.1428418 C13.3604939,39.1428418 11,37.9374832 11,35.1500915 C11,33.1160489 10.9246651,26.2856836 14.113843,26.2856836 C14.6411874,26.2856836 17.2527976,28.4201728 20.6428686,28.4201728 C21.7980039,28.4201728 22.902916,28.2192797 23.9827164,27.8426051 C23.9073815,28.3950611 23.8571582,28.9475172 23.8571582,29.4999732 C23.8571582,31.7851322 24.5853957,34.0451795 25.8912008,35.9285523 Z M52.7857641,51.9246651 C52.7857641,55.9927503 50.0988189,58.4285791 46.080957,58.4285791 L24.1333862,58.4285791 C20.1155243,58.4285791 17.4285791,55.9927503 17.4285791,51.9246651 C17.4285791,46.2494351 18.7594959,37.535697 26.1172055,37.535697 C26.9710012,37.535697 30.0848442,41.0262146 35.1071716,41.0262146 C40.129499,41.0262146 43.243342,37.535697 44.0971377,37.535697 C51.4548473,37.535697 52.7857641,46.2494351 52.7857641,51.9246651 Z M27.0714477,19.8571045 C27.0714477,23.3978454 24.1836095,26.2856836 20.6428686,26.2856836 C17.1021278,26.2856836 14.2142895,23.3978454 14.2142895,19.8571045 C14.2142895,16.3163637 17.1021278,13.4285254 20.6428686,13.4285254 C24.1836095,13.4285254 27.0714477,16.3163637 27.0714477,19.8571045 Z M44.7500402,29.4999732 C44.7500402,34.8236402 40.4308387,39.1428418 35.1071716,39.1428418 C29.7835045,39.1428418 25.464303,34.8236402 25.464303,29.4999732 C25.464303,24.1763061 29.7835045,19.8571045 35.1071716,19.8571045 C40.4308387,19.8571045 44.7500402,24.1763061 44.7500402,29.4999732 Z M59.2143432,35.1500915 C59.2143432,37.9374832 56.8538493,39.1428418 54.3426856,39.1428418 L50.9777262,39.1428418 C49.2952465,37.1339108 46.9347527,36.0038872 44.3231424,35.9285523 C45.6289475,34.0451795 46.357185,31.7851322 46.357185,29.4999732 C46.357185,28.9475172 46.3069617,28.3950611 46.2316268,27.8426051 C47.3114272,28.2192797 48.4163392,28.4201728 49.5714746,28.4201728 C52.9615456,28.4201728 55.5731558,26.2856836 56.1005002,26.2856836 C59.2896781,26.2856836 59.2143432,33.1160489 59.2143432,35.1500915 Z M56.0000536,19.8571045 C56.0000536,23.3978454 53.1122154,26.2856836 49.5714746,26.2856836 C46.0307337,26.2856836 43.1428955,23.3978454 43.1428955,19.8571045 C43.1428955,16.3163637 46.0307337,13.4285254 49.5714746,13.4285254 C53.1122154,13.4285254 56.0000536,16.3163637 56.0000536,19.8571045 Z" />
    </svg>
  )
}

function LibrarySvg() {
  return (
    <svg fill="#1A77CA" viewBox="0 0 20 20" width="28" height="28">
      <path d="M2 3.0001C2 2.44698 2.44687 2.0001 3 2.0001H5C5.55312 2.0001 6 2.44698 6 3.0001V5.0001H2V3.0001ZM2 6.0001H6V14.0001H2V6.0001ZM2 15.0001H6V17.0001C6 17.5532 5.55312 18.0001 5 18.0001H3C2.44687 18.0001 2 17.5532 2 17.0001V15.0001ZM7 3.0001C7 2.44698 7.44688 2.0001 8 2.0001H10C10.5531 2.0001 11 2.44698 11 3.0001V5.0001H7V3.0001ZM7 6.0001H11V14.0001H7V6.0001ZM7 15.0001H11V17.0001C11 17.5532 10.5531 18.0001 10 18.0001H8C7.44688 18.0001 7 17.5532 7 17.0001V15.0001ZM13.3625 14.3782L12 9.26885V6.4626L15.1375 5.62198L17.2 13.3532L13.3625 14.3782ZM14.8813 4.65635L12 5.4251V2.34385L13.1531 2.03448C13.6812 1.89073 14.2281 2.20635 14.3687 2.74073L14.8813 4.65635ZM13.6187 15.3439L17.4563 14.3157L17.9656 16.2251C18.1063 16.7564 17.7937 17.3032 17.2625 17.447L15.3438 17.9626C14.8156 18.1063 14.2688 17.7907 14.1281 17.2564L13.6187 15.3439Z" />
    </svg>
  )
}

function OtherSvg() {
  return (
    <svg fill="currentColor" viewBox="0 0 70 70" width="28" height="28">
      <path d="M50.05616,29.941065 C51.42046,29.941065 52.60521,30.443665 53.60936,31.446765 C54.61246,32.450915 55.11506,33.635665 55.11506,34.999965 C55.11506,36.365315 54.61246,37.550065 53.60936,38.553165 C52.60521,39.557315 51.42046,40.058865 50.05616,40.058865 C48.69081,40.058865 47.50606,39.557315 46.50296,38.553165 C45.49881,37.550065 44.99726,36.365315 44.99726,34.999965 C44.99726,33.635665 45.49881,32.450915 46.50296,31.446765 C47.50606,30.443665 48.69081,29.941065 50.05616,29.941065 M34.99986,29.941065 C36.36451,29.941065 37.54926,30.443665 38.55341,31.446765 C39.55616,32.450915 40.05911,33.635665 40.05911,34.999965 C40.05911,36.365315 39.55616,37.550065 38.55341,38.553165 C37.54926,39.557315 36.36451,40.058865 34.99986,40.058865 C33.63486,40.058865 32.44976,39.557315 31.44701,38.553165 C30.44286,37.550065 29.94131,36.365315 29.94131,34.999965 C29.94131,33.635665 30.44286,32.450915 31.44701,31.446765 C32.44976,30.443665 33.63486,29.941065 34.99986,29.941065 M19.94391,29.941065 C21.30856,29.941065 22.49331,30.443665 23.49711,31.446765 C24.50021,32.450915 25.00281,33.635665 25.00281,34.999965 C25.00281,36.365315 24.50021,37.550065 23.49711,38.553165 C22.49331,39.557315 21.30856,40.058865 19.94391,40.058865 C18.57856,40.058865 17.39381,39.557315 16.39071,38.553165 C15.38656,37.550065 14.88501,36.365315 14.88501,34.999965 C14.88501,33.635665 15.38656,32.450915 16.39071,31.446765 C17.39381,30.443665 18.57856,29.941065 19.94391,29.941065" />
    </svg>
  )
}

// ── Category groups data ───────────────────────────────────────────────────────

interface Category {
  id: string
  label: string
  icon: React.ReactNode
}

interface CategoryGroup {
  groupLabel?: string
  items: Category[]
}

const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    items: [{ id: 'featured', label: 'Featured', icon: <FeaturedSvg /> }],
  },
  {
    groupLabel: 'Development and Scripting',
    items: [
      { id: 'script', label: 'Script', icon: <ScriptSvg /> },
      { id: 'package', label: 'Package', icon: <PackageSvg /> },
    ],
  },
  {
    groupLabel: 'Containers and Orchestration',
    items: [
      { id: 'kubernetes', label: 'Kubernetes', icon: <KubernetesSvg /> },
      { id: 'docker', label: 'Docker', icon: <DockerSvg /> },
    ],
  },
  {
    groupLabel: 'Infrastructure as Code',
    items: [
      { id: 'terraform', label: 'Terraform', icon: <TerraformSvg /> },
    ],
  },
  {
    groupLabel: 'Cloud Native Services',
    items: [
      { id: 'aws', label: 'AWS', icon: <AwsSvg /> },
      { id: 'azure', label: 'Azure', icon: <AzureSvg /> },
      { id: 'gcp', label: 'Google Cloud', icon: <GcpSvg /> },
    ],
  },
  {
    groupLabel: 'Server Environments',
    items: [
      { id: 'windows', label: 'Windows Server', icon: <WindowsSvg /> },
    ],
  },
  {
    groupLabel: 'Other',
    items: [
      { id: 'certificate', label: 'Certificate', icon: <CertificateSvg /> },
      { id: 'community', label: 'Community Steps', icon: <CommunitySvg /> },
      { id: 'library', label: 'Library Step Templates', icon: <LibrarySvg /> },
      { id: 'other', label: 'Other', icon: <OtherSvg /> },
    ],
  },
]

// ── Featured step templates ────────────────────────────────────────────────────

interface FeaturedTemplate {
  id: string
  title: string
  actionType: string
  bullets: string[]
}

const FEATURED_TEMPLATES: FeaturedTemplate[] = [
  {
    id: 'k8s-containers',
    title: 'Configure and apply Kubernetes resources',

    actionType: 'Squid.KubernetesDeployContainers',
    bullets: [
      'Use the Squid UI to configure Kubernetes resources',
      'No YAML files required',
    ],
  },
  {
    id: 'k8s-ingress',
    title: 'Deploy Kubernetes Ingress',
    actionType: 'Squid.KubernetesDeployIngress',
    bullets: ['Deploy a standalone Ingress resource'],
  },
  {
    id: 'k8s-service',
    title: 'Deploy Kubernetes Service',
    actionType: 'Squid.KubernetesDeployService',
    bullets: ['Deploy a standalone Service resource'],
  },
  {
    id: 'k8s-configmap',
    title: 'Deploy Kubernetes ConfigMap',
    actionType: 'Squid.KubernetesDeployConfigMap',
    bullets: ['Deploy a standalone ConfigMap resource'],
  },
  {
    id: 'k8s-secret',
    title: 'Deploy Kubernetes Secret',
    actionType: 'Squid.KubernetesDeploySecret',
    bullets: ['Deploy a standalone Opaque Secret resource'],
  },
  {
    id: 'helm',
    title: 'Deploy a Helm Chart',

    actionType: 'Squid.HelmChartUpgrade',
    bullets: [
      'Source a Helm Chart from a Git repository or package',
      'Install or upgrade a Helm release on a Kubernetes cluster',
    ],
  },
  {
    id: 'k8s-yaml',
    title: 'Deploy Kubernetes YAML',

    actionType: 'Squid.KubernetesDeployRawYaml',
    bullets: [
      'Source YAML files from a Git repository or package',
      'Apply to your Kubernetes cluster',
    ],
  },
  {
    id: 'kustomize',
    title: 'Deploy with Kustomize',

    actionType: 'Squid.Kubernetes.Kustomize',
    bullets: [
      'Source YAML files from a Git repository or package',
      'Use Kustomize to customize YAML files',
      'Apply to your Kubernetes cluster',
    ],
  },
  {
    id: 'script',
    title: 'Run a Script',

    actionType: 'Squid.Script',
    bullets: ['Runs a PowerShell, Bash, C#, F#, or Python script.'],
  },
  {
    id: 'azure-script',
    title: 'Run an Azure Script',

    actionType: 'Squid.AzurePowerShell',
    bullets: ['Runs a custom script using an Azure subscription, with the Azure modules loaded by default.'],
  },
  {
    id: 'aws-script',
    title: 'Run an AWS CLI Script',

    actionType: 'Squid.AwsRunScript',
    bullets: ['Runs a custom script with AWS credentials and the AWS CLI provided'],
  },
  {
    id: 'iis',
    title: 'Deploy to IIS',

    actionType: 'Squid.IIS',
    bullets: ['Deploy the contents of a package to a Website, a Web Application or a Virtual Directory.'],
  },
  {
    id: 'package',
    title: 'Deploy a Package',

    actionType: 'Squid.TentaclePackage',
    bullets: ['Deploy the contents of a package to one or more deployment targets.'],
  },
  {
    id: 'azure-app',
    title: 'Deploy an Azure App Service',

    actionType: 'Squid.AzureAppService',
    bullets: ['Deploy a package or container image to an Azure App Service (Azure Web App)'],
  },
  {
    id: 'manual',
    title: 'Manual Intervention Required',

    actionType: 'Squid.Manual',
    bullets: ['Pauses deployment for human intervention, often used for approval workflow.'],
  },
]

// ── Check icon ─────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" className="text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6.5" />
      <path d="M5 8.5L7 10.5L11 6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Add Step Panel ─────────────────────────────────────────────────────────────

function AddStepPanel({ spaceId, onTemplateSelected }: { spaceId: string; onTemplateSelected?: (actionType: string) => void }) {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('featured')

  const allCategories = CATEGORY_GROUPS.flatMap((g) => g.items)
  const selectedCategoryLabel = allCategories.find((c) => c.id === selectedCategory)?.label ?? 'Featured'

  const filtered = FEATURED_TEMPLATES.filter(
    (t) =>
      !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.bullets.some((b) => b.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4">
        <h2 className="text-xl font-semibold text-slate-800 m-0">Add Step Template</h2>
      </div>

      <div className="px-6 pb-3">
        <div className="flex items-center gap-2 border-b border-slate-300 pb-1.5" style={{ maxWidth: 400 }}>
          <svg className="text-slate-400 flex-shrink-0" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <input
            type="search"
            placeholder="Filter by name, category or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border-0 outline-none text-sm text-slate-700 placeholder-slate-400 bg-transparent"
          />
        </div>
      </div>

      <hr className="border-slate-200 mx-0" />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-shrink-0 border-r border-slate-200 overflow-y-auto py-4" style={{ width: 240 }}>
          <div className="px-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">
              Filter Categories
            </div>
            <div className="grid grid-cols-2 gap-1">
              {CATEGORY_GROUPS.map((group, gi) => (
                <React.Fragment key={gi}>
                  {group.groupLabel && (
                    <div className="col-span-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1 pt-3 pb-1">
                      {group.groupLabel}
                    </div>
                  )}
                  {group.items.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`flex flex-col items-center gap-1 py-2 px-1 rounded text-center transition-colors border ${
                        selectedCategory === cat.id
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'border-transparent hover:bg-slate-100 text-slate-600'
                      }`}
                    >
                      <span className="leading-none">{cat.icon}</span>
                      <span className="text-[9px] leading-tight font-medium">{cat.label}</span>
                    </button>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-5">
            <div className="text-sm font-semibold text-slate-800 mb-0.5">{selectedCategoryLabel}</div>
            <p className="text-xs text-slate-400 mb-4 m-0 mb-4">Try a featured step template or filter by category</p>
            <ol
              className="list-none m-0 p-0 gap-3"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}
            >
              {filtered.map((tpl) => (
                <li
                  key={tpl.id}
                  className="flex flex-col border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all bg-white"
                >
                  {/* Card body */}
                  <div className="flex-1 px-4 pt-5 pb-3">
                    {/* Logo — centred */}
                    <div className="flex items-center justify-center mb-3">
                      <div className="rounded overflow-hidden bg-slate-100" style={{ width: 48, height: 48 }}>
                        <img
                          src={stepLogoUrl(spaceId, tpl.actionType)}
                          alt={tpl.title}
                          className="w-full h-full object-contain"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                        />
                      </div>
                    </div>
                    {/* Title + author */}
                    <div className="text-sm font-semibold text-slate-800 text-center leading-snug mb-2.5">{tpl.title}</div>
                    {/* Bullets */}
                    <ul className="list-none m-0 p-0 space-y-1">
                      {tpl.bullets.map((b, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <CheckIcon />
                          <span className="text-xs text-slate-500 leading-relaxed">{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* Add Step button pinned to bottom */}
                  <div className="px-4 pb-5">
                    <button
                      onClick={() => onTemplateSelected?.(tpl.actionType)}
                      className="w-full px-3 py-1.5 rounded border border-slate-300 text-sm font-medium text-slate-700 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      Add Step
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Step detail panel ─────────────────────────────────────────────────────────

function StepDetailPanel({ step, spaceId }: { step: DeploymentStepDto; spaceId: string }) {
  const firstAction = step.actions[0]

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-shrink-0 rounded overflow-hidden bg-slate-100" style={{ width: 40, height: 40 }}>
          {firstAction && (
            <img
              src={stepLogoUrl(spaceId, firstAction.actionType)}
              alt={step.name}
              className="w-full h-full object-contain"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          )}
        </div>
        <h2 className="text-xl font-semibold text-slate-800 m-0">{step.name}</h2>
        {step.isDisabled && (
          <span className="text-xs bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">Disabled</span>
        )}
      </div>

      <div className="space-y-3 text-sm mb-6">
        {step.condition && step.condition !== 'Success' && (
          <div className="flex gap-2">
            <span className="text-slate-500 w-28 flex-shrink-0">Condition</span>
            <span className="text-slate-700">{step.condition}</span>
          </div>
        )}
        {step.startTrigger && (
          <div className="flex gap-2">
            <span className="text-slate-500 w-28 flex-shrink-0">Start Trigger</span>
            <span className="text-slate-700">{step.startTrigger}</span>
          </div>
        )}
      </div>

      {step.actions.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Actions</div>
          <div className="space-y-2">
            {step.actions.map((action) => (
              <div key={action.id} className="p-3 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-700">{action.name || action.actionType}</span>
                  {action.isDisabled && (
                    <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full">Disabled</span>
                  )}
                </div>
                <div className="text-xs text-slate-400">{action.actionType}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step logo with fallback ────────────────────────────────────────────────────

function StepLogoImg({ actionType, spaceId, name }: { actionType: string; spaceId: string; name: string }) {
  const [failed, setFailed] = React.useState(false)

  if (failed) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-400">
        <KubernetesSvg />
      </div>
    )
  }

  return (
    <img
      src={stepLogoUrl(spaceId, actionType)}
      alt={name}
      className="w-full h-full object-contain"
      onError={() => setFailed(true)}
    />
  )
}

// ── Editor sidebar step item ───────────────────────────────────────────────────

function StepItem({
  step,
  index,
  selected,
  spaceId,
  onClick,
}: {
  step: DeploymentStepDto
  index: number
  total: number
  selected: boolean
  spaceId: string
  onClick: () => void
}) {
  const firstAction = step.actions[0]

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className={`flex items-stretch cursor-pointer select-none outline-none transition-colors border-l-[3px] ${
        selected ? 'bg-blue-50 border-l-blue-600' : 'border-l-transparent hover:bg-slate-50'
      }`}
    >
      <div className="flex-shrink-0 flex items-start pt-2.5 pb-2.5 pl-2 pr-2" style={{ opacity: step.isDisabled ? 0.4 : 1 }}>
        <div className="rounded overflow-hidden bg-slate-100 flex-shrink-0" style={{ width: 32, height: 32 }}>
          {firstAction && <StepLogoImg actionType={firstAction.actionType} spaceId={spaceId} name={step.name} />}
        </div>
      </div>

      <div className="flex-1 min-w-0 flex items-start pt-2.5 pb-2.5 pr-1 gap-1" style={{ opacity: step.isDisabled ? 0.5 : 1 }}>
        <span className="text-xs font-semibold flex-shrink-0 leading-[1.6] text-slate-800">{index + 1}.</span>
        <span className={`text-sm leading-snug break-words min-w-0 ${selected ? 'text-blue-700 font-medium' : 'text-slate-700'}`}>
          {step.name}
        </span>
      </div>

      <button
        className="flex-shrink-0 self-start mt-2 p-1.5 rounded mr-1 hover:bg-slate-200 transition-colors"
        onClick={(e) => e.stopPropagation()}
        aria-label="Step options"
      >
        <MoreOutlined style={{ fontSize: 15, color: '#64748b' }} />
      </button>
    </div>
  )
}

// ── Draft step item (new step being created, not yet saved) ───────────────────

function DraftStepItem({
  index,
  actionType,
  stepName,
  spaceId,
}: {
  index: number
  total: number
  actionType: string
  stepName: string
  spaceId: string
}) {
  const displayName = stepName.trim() || 'Configure and apply Kubernetes resources'

  return (
    <div className="flex items-stretch border-l-[3px] border-l-blue-600 bg-blue-50">
      <div className="flex-shrink-0 flex items-start pt-2.5 pb-2.5 pl-2 pr-2">
        <div className="rounded overflow-hidden bg-slate-100 flex-shrink-0" style={{ width: 32, height: 32 }}>
          <StepLogoImg actionType={actionType} spaceId={spaceId} name={displayName} />
        </div>
      </div>

      <div className="flex-1 min-w-0 flex items-start pt-2.5 pb-2.5 pr-1 gap-1">
        <span className="text-xs font-semibold flex-shrink-0 leading-[1.6] text-slate-800">{index + 1}.</span>
        <span className="text-sm leading-snug break-words min-w-0 text-slate-700">{displayName}</span>
      </div>

      <button
        className="flex-shrink-0 self-start mt-2 p-1.5 rounded mr-1 hover:bg-slate-200 transition-colors"
        onClick={(e) => e.stopPropagation()}
        aria-label="Step options"
      >
        <MoreOutlined style={{ fontSize: 15, color: '#64748b' }} />
      </button>
    </div>
  )
}

// ── Overview step item ─────────────────────────────────────────────────────────

function OverviewStepItem({
  step,
  index,
  total,
  spaceId,
  envMap,
}: {
  step: DeploymentStepDto
  index: number
  total: number
  spaceId: string
  envMap: Record<number, string>
}) {
  const firstAction = step.actions[0]
  const envNames = (firstAction?.environments ?? []).map((id) => envMap[id]).filter(Boolean)
  const summary = firstAction ? actionSummary(firstAction.actionType) : ''
  const isLast = index === total - 1

  return (
    <div className="group relative flex gap-3">
      {/* Connector column */}
      <div className="flex flex-col items-center flex-shrink-0" style={{ width: 32 }}>
        <div className="relative z-10 w-8 h-8 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">
          {index + 1}
        </div>
        {!isLast && (
          <div className="w-px bg-slate-200 my-1" style={{ flex: 1, minHeight: 16 }} />
        )}
      </div>

      {/* Logo */}
      <div className="flex-shrink-0" style={{ opacity: step.isDisabled ? 0.4 : 1 }}>
        <div className="rounded border border-slate-200 bg-slate-50 overflow-hidden" style={{ width: 36, height: 36 }}>
          {firstAction && (
            <img
              src={stepLogoUrl(spaceId, firstAction.actionType)}
              alt={step.name}
              className="w-full h-full object-contain"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          )}
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 min-w-0 ${isLast ? 'pb-2' : 'pb-6'}`}>
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className={`font-semibold text-sm leading-snug ${step.isDisabled ? 'text-slate-400' : 'text-slate-800'}`}>
            {step.name}
          </span>
          {step.isDisabled && (
            <span className="text-[10px] font-medium bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-200">
              Disabled
            </span>
          )}
        </div>
        {summary && (
          <p className="text-xs text-slate-500 m-0 mb-1.5 leading-relaxed">{summary}</p>
        )}
        {envNames.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {envNames.map((name) => (
              <span
                key={name}
                className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200"
              >
                {name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Overflow button */}
      <button
        className="flex-shrink-0 self-start mt-0.5 p-1.5 rounded text-slate-300 hover:text-slate-500 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-all"
        aria-label="Step options"
        onClick={(e) => e.stopPropagation()}
      >
        <MoreOutlined style={{ fontSize: 14 }} />
      </button>
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const LINK_BTN =
  'inline-flex items-center px-3 py-[5px] text-[13px] font-medium rounded border border-squid-blue/40 text-squid-blue hover:border-squid-blue hover:bg-squid-blue/[0.04] transition-colors no-underline cursor-pointer select-none'

const ICON_BTN =
  'flex items-center justify-center w-8 h-8 rounded-full text-slate-500 hover:bg-slate-100 transition-colors'

// ── Process Overview ───────────────────────────────────────────────────────────

function ProcessOverview({
  steps,
  loading,
  spaceId,
  lifecycle,
  envMap,
  onAddStep,
}: {
  steps: DeploymentStepDto[]
  loading: boolean
  spaceId: string
  lifecycle: LifecycleDto | null
  envMap: Record<number, string>
  onAddStep: () => void
}) {
  const [search, setSearch] = useState('')
  const filtered = search
    ? steps.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : steps

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
        <h1 className="text-xl font-semibold text-slate-800 m-0">Process</h1>
        <div className="flex items-center gap-2">
          <a href="#" title="Create Release" role="link" className={LINK_BTN}>
            Create Release
          </a>
          <a
            href="#"
            title="Add Step"
            role="link"
            onClick={(e) => { e.preventDefault(); onAddStep() }}
            className={LINK_BTN}
          >
            Add Step
          </a>
          <button className={ICON_BTN} aria-label="Overflow Menu Button">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 px-6 py-2.5 flex-shrink-0">
        <div className="flex items-center gap-2 border-b border-slate-300 pb-1.5" style={{ maxWidth: 320 }}>
          <svg className="text-slate-400 flex-shrink-0" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <input
            type="search"
            placeholder="Filter by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border-0 outline-none text-sm text-slate-700 placeholder-slate-400 bg-transparent"
          />
        </div>
        <button className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1.5">
          <FilterOutlined style={{ fontSize: 13 }} />
          <span>Show advanced filters</span>
        </button>
      </div>

      {/* Body: step list + sidebar */}
      <div className="flex flex-1 min-h-0">
        {/* Step list */}
        <div className="flex-1 overflow-y-auto">
          <Spin spinning={loading}>
            {!loading && filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <p className="text-slate-400 text-sm m-0">No steps added yet.</p>
                <button
                  onClick={onAddStep}
                  className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Add Step
                </button>
              </div>
            ) : (
              <div className="px-6 pt-6 pb-4">
                {filtered.map((step, i) => (
                  <OverviewStepItem
                    key={step.id}
                    step={step}
                    index={i}
                    total={filtered.length}
                    spaceId={spaceId}
                    envMap={envMap}
                  />
                ))}
              </div>
            )}
          </Spin>
        </div>

        {/* Right sidebar */}
        <div className="flex-shrink-0 border-l border-slate-200 overflow-y-auto p-5" style={{ width: 248 }}>
          {/* Lifecycle */}
          <div className="mb-6">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Lifecycle</div>
            {lifecycle ? (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <a href="#" className="text-sm font-medium text-squid-blue hover:underline truncate mr-2">
                    {lifecycle.name}
                  </a>
                  <button className="text-xs text-slate-400 hover:text-slate-600 flex-shrink-0">Change</button>
                </div>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {lifecycle.phases.map((phase, i) => (
                    <React.Fragment key={phase.id}>
                      {i > 0 && (
                        <svg viewBox="0 0 16 16" width="8" height="8" className="text-slate-300 flex-shrink-0" fill="currentColor">
                          <path d="M5 3l6 5-6 5V3z" />
                        </svg>
                      )}
                      <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                        {phase.name}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 m-0">Not configured</p>
            )}
          </div>

          {/* Script Modules */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Script Modules</div>
            <a href="#" className="text-xs text-squid-blue hover:underline">Include Script Modules</a>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const Process: React.FC = () => {
  const { projectName, spaceId = 'Spaces-1' } = useParams<{ projectName: string; spaceId: string }>()
  const [mode, setMode] = useState<'overview' | 'editor'>('overview')
  const [loading, setLoading] = useState(false)
  const [steps, setSteps] = useState<DeploymentStepDto[]>([])
  const [lifecycle, setLifecycle] = useState<LifecycleDto | null>(null)
  const [envMap, setEnvMap] = useState<Record<number, string>>({})
  const [sidebarFilter, setSidebarFilter] = useState('')
  const [selectedStepId, setSelectedStepId] = useState<number | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<{ actionType: string; step: DeploymentStepDto | null } | null>(null)
  const [draftStepName, setDraftStepName] = useState('')
  const [processId, setProcessId] = useState<number>(0)
  const editorRef = useRef<StepEditorHandle>(null)

  useEffect(() => {
    if (!projectName) return
    setLoading(true)

    ;(async () => {
      try {
        const projRes = await getProjects({ pageSize: 500 })
        const project = projRes.projects.find(
          (p) => p.slug === projectName || p.name === projectName
        )
        if (!project) return
        setProcessId(project.deploymentProcessId)

        const [stepsRes, lifecyclesRes, progressionRes] = await Promise.all([
          getDeploymentSteps({ processId: project.deploymentProcessId, pageSize: 500 }),
          getLifecycles({ pageSize: 1000 }),
          getProjectProgression(project.id),
        ])

        setSteps([...stepsRes.steps].sort((a, b) => a.stepOrder - b.stepOrder))

        const lc = lifecyclesRes.lifecycles.find((l) => l.id === project.lifecycleId)
        if (lc) setLifecycle(lc)

        const map: Record<number, string> = {}
        for (const env of progressionRes.environments) {
          map[env.id] = env.name
        }
        setEnvMap(map)
      } catch {
        // silently handle
      } finally {
        setLoading(false)
      }
    })()
  }, [projectName])

  const filteredSteps = sidebarFilter
    ? steps.filter((s) => s.name.toLowerCase().includes(sidebarFilter.toLowerCase()))
    : steps

  const selectedStep = selectedStepId !== null
    ? steps.find((s) => s.id === selectedStepId) ?? null
    : null

  if (mode === 'overview') {
    return (
      <ProcessOverview
        steps={steps}
        loading={loading}
        spaceId={spaceId}
        lifecycle={lifecycle}
        envMap={envMap}
        onAddStep={() => setMode('editor')}
      />
    )
  }

  // ── Editor mode ────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-200">
        {/* Breadcrumb row */}
        <div className="px-6 pt-3 pb-0">
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-1 list-none m-0 p-0">
              <li>
                <button
                  onClick={() => setMode('overview')}
                  className="text-sm text-squid-blue hover:underline font-medium"
                >
                  Process
                </button>
              </li>
            </ol>
          </nav>
        </div>
        {/* Title + actions row */}
        <div className="flex items-center justify-between px-6 py-3">
          <h1 className="text-xl font-semibold text-slate-800 m-0">Process Editor</h1>
          <div className="flex items-center gap-2">
            <a href="#" title="Create Release" role="link" className={LINK_BTN}>
              Create Release
            </a>
            <button
              title="Add Step"
              onClick={() => { setSelectedStepId(null); setEditingTemplate(null) }}
              className="inline-flex items-center px-3 py-[5px] text-[13px] font-medium rounded border border-squid-blue bg-squid-blue text-white hover:bg-blue-700 hover:border-blue-700 transition-colors"
            >
              Add Step
            </button>
            <button
              title="Save"
              disabled={!editingTemplate}
              onClick={() => editorRef.current?.save()}
              className={`inline-flex items-center px-3 py-[5px] text-[13px] font-medium rounded border transition-colors ${
                editingTemplate
                  ? 'border-green-600 bg-green-600 text-white hover:bg-green-700 hover:border-green-700'
                  : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              Save
            </button>
            <button className={ICON_BTN} aria-label="Overflow Menu Button">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        <div className="flex-shrink-0 border-r border-slate-200 flex flex-col" style={{ width: 280 }}>
          <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0">
            <div className="flex items-center gap-2 flex-1 border-b border-slate-300 pb-1.5">
              <svg className="text-slate-400 flex-shrink-0" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
              </svg>
              <input
                type="search"
                placeholder="Filter by name..."
                value={sidebarFilter}
                onChange={(e) => setSidebarFilter(e.target.value)}
                className="flex-1 border-0 outline-none text-sm text-slate-700 placeholder-slate-400 bg-transparent"
              />
            </div>
            <button className="p-1 rounded hover:bg-slate-100 text-slate-400" aria-label="Options">
              <MoreOutlined style={{ fontSize: 16 }} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Spin />
              </div>
            ) : (
              <>
                {filteredSteps.map((step, i) => (
                  <StepItem
                    key={step.id}
                    step={step}
                    index={i}
                    total={0}
                    selected={selectedStepId === step.id}
                    spaceId={spaceId}
                    onClick={() => setSelectedStepId((prev) => (prev === step.id ? null : step.id))}
                  />
                ))}
                {editingTemplate && !editingTemplate.step && (
                  <DraftStepItem
                    index={filteredSteps.length}
                    total={0}
                    actionType={editingTemplate.actionType}
                    stepName={draftStepName}
                    spaceId={spaceId}
                  />
                )}
                {filteredSteps.length === 0 && !(editingTemplate && !editingTemplate.step) && (
                  <div className="px-4 py-8 text-center text-sm text-slate-400">
                    {sidebarFilter ? 'No steps match filter' : 'No steps yet'}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {editingTemplate && STEP_EDITOR_MAP[editingTemplate.actionType] ? (() => {
            const EditorComponent = STEP_EDITOR_MAP[editingTemplate.actionType]
            return (
              <EditorComponent
                ref={editorRef}
                step={editingTemplate.step}
                processId={processId}
                spaceId={spaceId}
                stepIndex={editingTemplate.step ? steps.findIndex((s) => s.id === editingTemplate.step!.id) : steps.length}
                onSave={(savedStep) => {
                  setSteps((prev) => {
                    const exists = prev.some((s) => s.id === savedStep.id)
                    const next = exists
                      ? prev.map((s) => (s.id === savedStep.id ? savedStep : s))
                      : [...prev, savedStep]
                    return next.sort((a, b) => a.stepOrder - b.stepOrder)
                  })
                  setEditingTemplate(null)
                  setDraftStepName('')
                  setSelectedStepId(savedStep.id)
                }}
                onStepNameChange={(name) => setDraftStepName(name)}
              />
            )
          })() : selectedStep ? (
            <StepDetailPanel step={selectedStep} spaceId={spaceId} />
          ) : (
            <AddStepPanel
              spaceId={spaceId}
              onTemplateSelected={(actionType) => {
                setSelectedStepId(null)
                setDraftStepName('')
                setEditingTemplate({ actionType, step: null })
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default Process
