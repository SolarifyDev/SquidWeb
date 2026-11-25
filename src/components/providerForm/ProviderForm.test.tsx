import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ProviderFieldDescriptor } from 'pages/apis/packageStore'
import ProviderForm, { UNCHANGED_SECRET_PLACEHOLDER } from './ProviderForm'
import { buildInitialValue, buildSubmission, validateProviderForm, type ProviderFormValue } from './providerFormValues'

const FIELDS: ProviderFieldDescriptor[] = [
  { key: 'Bucket', label: 'Bucket', kind: 'Text', required: true, placeholder: 'my-bucket', helpText: 'Name of the bucket', options: [] },
  { key: 'Root', label: 'Root folder', kind: 'Path', required: false, options: [] },
  { key: 'Secret', label: 'Secret key', kind: 'Secret', required: true, options: [] },
  { key: 'Tier', label: 'Tier', kind: 'Select', required: false, default: 'Cool', options: ['Hot', 'Cool'] },
  { key: 'Encrypt', label: 'Encrypt', kind: 'Toggle', required: false, default: 'true', options: [] },
]

function Harness({ initial, secretHasValue, onValue }: { initial?: Record<string, string>; secretHasValue?: Record<string, boolean>; onValue: (value: ProviderFormValue) => void }) {
  const [value, setValue] = useState(() => buildInitialValue(FIELDS, initial))
  const [errors, setErrors] = useState({})
  onValue(value)
  return (
    <>
      <ProviderForm fields={FIELDS} value={value} onChange={setValue} secretHasValue={secretHasValue} errors={errors} />
      <button type="button" onClick={() => setErrors(validateProviderForm(FIELDS, value, secretHasValue))}>validate</button>
    </>
  )
}

function renderForm(props: { initial?: Record<string, string>; secretHasValue?: Record<string, boolean> } = {}) {
  let latest!: ProviderFormValue
  render(<Harness {...props} onValue={(value) => { latest = value }} />)
  return { submission: () => buildSubmission(FIELDS, latest) }
}

describe('ProviderForm unsupported field kinds', () => {
  const FUTURE: ProviderFieldDescriptor[] = [
    { key: 'Region', label: 'Region', kind: 'Text', required: true, options: [] },
    { key: 'Lifecycle', label: 'Lifecycle rules', kind: 'KeyValueList', required: true, options: [] },
  ]

  it('shows a note instead of an editor, and neither validates nor submits the field', () => {
    render(<ProviderForm fields={FUTURE} value={{ properties: { Region: 'eu', Lifecycle: 'x' }, secrets: {} }} onChange={() => {}} />)

    expect(screen.getByRole('note')).toHaveTextContent('Unsupported field type "KeyValueList"')
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(validateProviderForm(FUTURE, { properties: { Region: 'eu' }, secrets: {} })).toEqual({})
    expect(buildSubmission(FUTURE, { properties: { Region: 'eu', Lifecycle: 'x' }, secrets: {} }).properties).toEqual({ Region: 'eu' })
  })
})

describe('ProviderForm', () => {
  it('renders label, required marker, placeholder and help text from the descriptor', () => {
    renderForm()

    expect(screen.getByLabelText(/Bucket/)).toHaveAttribute('placeholder', 'my-bucket')
    expect(screen.getByText('Name of the bucket')).toBeInTheDocument()
    expect(screen.getByLabelText(/Root folder/)).toBeInTheDocument()
  })

  it('applies defaults of non-secret fields on a new form', () => {
    const { submission } = renderForm()

    expect(submission().properties).toMatchObject({ Tier: 'Cool', Encrypt: 'true' })
  })

  it('submits text, path and toggle values the user enters', () => {
    const { submission } = renderForm()

    fireEvent.change(screen.getByLabelText(/Bucket/), { target: { value: 'packages' } })
    fireEvent.change(screen.getByLabelText(/Root folder/), { target: { value: '/mnt/pkgs' } })
    fireEvent.click(screen.getByRole('switch'))

    expect(submission().properties).toMatchObject({ Bucket: 'packages', Root: '/mnt/pkgs', Encrypt: 'false' })
  })

  it('offers the select options and submits the chosen one', () => {
    const { submission } = renderForm()

    fireEvent.mouseDown(screen.getByRole('combobox'))
    fireEvent.click(screen.getByTitle('Hot'))

    expect(submission().properties.Tier).toBe('Hot')
  })

  it('blocks on a missing required field with a visible message', () => {
    renderForm()

    fireEvent.click(screen.getByText('validate'))

    expect(screen.getAllByRole('alert').map((node) => node.textContent)).toEqual(['Bucket is required', 'Secret key is required'])
  })

  it('does not send an untouched secret that already has a stored value, and does not demand it', () => {
    const { submission } = renderForm({ initial: { Bucket: 'b' }, secretHasValue: { Secret: true } })

    expect(screen.getByLabelText(/Secret key/)).toHaveAttribute('placeholder', UNCHANGED_SECRET_PLACEHOLDER)
    fireEvent.click(screen.getByText('validate'))

    expect(screen.queryAllByRole('alert')).toHaveLength(0)
    expect(submission().secrets).toEqual({})
  })

  it('sends a secret once the user types a new value', () => {
    const { submission } = renderForm({ initial: { Bucket: 'b' }, secretHasValue: { Secret: true } })

    fireEvent.change(screen.getByLabelText(/Secret key/), { target: { value: 'new-secret' } })

    expect(submission().secrets).toEqual({ Secret: 'new-secret' })
  })

  it('never puts a stored secret value into the form', () => {
    renderForm({ initial: { Bucket: 'b' }, secretHasValue: { Secret: true } })

    expect(screen.getByLabelText(/Secret key/)).toHaveValue('')
  })

  it('reports each change to the parent', () => {
    const onChange = vi.fn()
    render(<ProviderForm fields={FIELDS} value={{ properties: {}, secrets: {} }} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText(/Bucket/), { target: { value: 'x' } })

    expect(onChange).toHaveBeenCalledWith({ properties: { Bucket: 'x' }, secrets: {} })
  })
})
