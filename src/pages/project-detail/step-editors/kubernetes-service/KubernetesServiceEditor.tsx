import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { message } from 'antd'
import { MoreOutlined } from '@ant-design/icons'
import { createDeploymentStep, updateDeploymentStep } from 'pages/apis/deploymentProcess'
import { useContainersEditorState, serializeToStep } from '../kubernetes-containers/useContainersEditorState'
import { StepNameSection } from '../kubernetes-containers/sections/StepNameSection'
import { TargetTagsSection } from '../kubernetes-containers/sections/TargetTagsSection'
import { ServiceSection } from '../kubernetes-containers/sections/ServiceSection'
import { ConditionsSection } from '../kubernetes-containers/sections/ConditionsSection'
import type { StepEditorHandle, StepEditorProps } from '../shared/StepEditorTypes'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'https://localhost:7078/api'
const ACTION_TYPE = 'Squid.KubernetesDeployService'

export const KubernetesServiceEditor = forwardRef<StepEditorHandle, StepEditorProps>(
  function KubernetesServiceEditor({ step, processId, projectId, spaceId, stepIndex, onSave, onStepNameChange }, ref) {
    const { state, updateField } = useContainersEditorState(step)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
      onStepNameChange?.(state.stepName)
    }, [state.stepName])

    const handleSave = async () => {
      if (!state.stepName.trim()) {
        message.warning('Step name is required')
        return
      }

      setSaving(true)
      try {
        const stepDto = serializeToStep(state, processId, step ?? undefined, ACTION_TYPE)

        let saved
        if (step) {
          saved = await updateDeploymentStep({ id: step.id, step: stepDto })
        } else {
          saved = await createDeploymentStep({ processId, step: stepDto })
        }

        message.success(step ? 'Step updated' : 'Step created')
        onSave(saved)
      } catch {
        message.error('Failed to save step')
      } finally {
        setSaving(false)
      }
    }

    useImperativeHandle(ref, () => ({ save: handleSave }), [state, processId, step])

    const logoUrl = `${API_BASE}/${spaceId}/actiontemplates/${ACTION_TYPE}/logo`
    const displayName = state.stepName || 'Deploy Kubernetes Service'

    return (
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 rounded overflow-hidden bg-slate-100" style={{ width: 40, height: 40 }}>
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-slate-400 leading-tight">Deploy a standalone Service resource</div>
              <div className="flex items-center gap-1.5">
                {stepIndex != null && <span className="text-sm text-slate-400 font-medium">{stepIndex + 1}.</span>}
                <span className="text-sm font-semibold text-slate-800 truncate">{displayName}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button className="inline-flex items-center px-3 py-[5px] text-[13px] font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors">
              Configure features
            </button>
            <button className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition-colors" aria-label="More Step Actions">
              <MoreOutlined style={{ fontSize: 18 }} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <StepNameSection state={state} updateField={updateField} />
          <TargetTagsSection state={state} updateField={updateField} />
          <ServiceSection state={state} updateField={updateField} showNamespaceSection />
          <ConditionsSection state={state} updateField={updateField} projectId={projectId} />
        </div>
      </div>
    )
  }
)
