import { describe, expect, it, vi } from 'vitest'
import { apply } from '../src/client/index.js'

describe('client slot contract', () => {
  it('registers shell.overlay with a stable id', () => {
    const registrations: Array<{ name: string; options: Record<string, unknown> }> = []
    const slots = {
      inject: (name: string, register: () => unknown) => {
        registrations.push({ name, options: register() as Record<string, unknown> })
      },
      register: (options: Record<string, unknown>) => options,
    }
    const ctx = {
      effect: vi.fn(),
      locale: { register: vi.fn(() => () => {}) },
      sessions: { list: {} },
      slots,
      settingsScope: { bind: vi.fn(() => ({})) },
    }

    apply(ctx as never)

    expect(registrations).toContainEqual({
      name: 'shell.overlay',
      options: { name: 'shell.overlay', id: 'openrouter-providers-overlay' },
    })
  })
})
