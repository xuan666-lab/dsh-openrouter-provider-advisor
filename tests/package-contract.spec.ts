import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as Record<string, any>

describe('publishable DSH package contract', () => {
  it('publishes under the approved public package name with a build gate', () => {
    expect(pkg.name).toBe('dsh-openrouter-provider-advisor')
    expect(pkg.private).not.toBe(true)
    expect(pkg.publishConfig).toEqual(expect.objectContaining({ access: 'public' }))
    expect(pkg.scripts.prepublishOnly).toContain('npm run verify')
  })

  it('ships the DSH bundle, manifest, declarations, docs, and license', () => {
    expect(pkg.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(pkg.files).toEqual(expect.arrayContaining(['lib/**/*.js', 'lib/types/**/*.d.ts', 'cordis.patch.yml', 'dsh.plugin.json', 'README.md', 'README_EN.md', 'docs/images/*.png', 'LICENSE']))
    const patch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
    expect(patch).toContain('name: dsh-openrouter-provider-advisor')
    const manifest = JSON.parse(readFileSync(new URL('../dsh.plugin.json', import.meta.url), 'utf8'))
    expect(manifest).toMatchObject({ id: 'dsh-external/dsh-openrouter-provider-advisor', main: './lib/index.js', client: { main: './lib/client.js' } })
    expect(manifest.engines.dsh).toBe('>=0.1.2-rc.1')
  })
})
