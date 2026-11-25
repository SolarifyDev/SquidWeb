import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VersionRuleEditor } from './VersionRuleEditor'

const getRule = vi.fn()
const setRule = vi.fn()

vi.mock('pages/apis/builtInPackages', () => ({
  getPackageVersionRule: (...args: unknown[]) => getRule(...args),
  setPackageVersionRule: (...args: unknown[]) => setRule(...args),
}))

describe('VersionRuleEditor', () => {
  beforeEach(() => {
    getRule.mockReset().mockResolvedValue({ feedId: 7, packageId: 'Acme', versionTemplate: '1.0.{counter}', isDefault: true })
    setRule.mockReset()
  })

  it.each([
    ['Auto-increment', '1.0.{counter}'],
    ['Date + daily counter', '{date:yyyy.MM.dd}.{counter:daily}'],
    ['From project file', '{source.version}'],
    ['Typed each time', '{input}'],
  ])('preset%s_FillsTheInput', async (label, template) => {
    render(<VersionRuleEditor feedId={7} packageId="Acme" canEdit />)
    await screen.findByLabelText('Version template')

    fireEvent.click(screen.getByRole('button', { name: label }))

    expect(screen.getByLabelText('Version template')).toHaveValue(template)
  })

  it('save_SendsTheTemplateForThePackage', async () => {
    setRule.mockResolvedValue({ feedId: 7, packageId: 'Acme', versionTemplate: '{input}', isDefault: false })
    const onSaved = vi.fn()
    render(<VersionRuleEditor feedId={7} packageId="Acme" canEdit onSaved={onSaved} />)
    await screen.findByLabelText('Version template')

    fireEvent.click(screen.getByRole('button', { name: 'Typed each time' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('{input}'))
    expect(setRule).toHaveBeenCalledWith(7, 'Acme', '{input}')
  })

  it('validationErrorFromTheApi_IsShownInline_AndClearedOnEdit', async () => {
    setRule.mockRejectedValue({ response: { status: 400, data: { msg: "Unknown version token '{nope}'" } } })
    render(<VersionRuleEditor feedId={7} packageId="Acme" canEdit />)
    const input = await screen.findByLabelText('Version template')

    fireEvent.change(input, { target: { value: '{nope}' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Unknown version token '{nope}'")

    fireEvent.change(input, { target: { value: '1.{counter}' } })

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('withoutFeedEdit_ThereIsNoSaveAndTheInputIsReadOnly', async () => {
    render(<VersionRuleEditor feedId={7} packageId="Acme" canEdit={false} />)

    expect(await screen.findByLabelText('Version template')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })
})
