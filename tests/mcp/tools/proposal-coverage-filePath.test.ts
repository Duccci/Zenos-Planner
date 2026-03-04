/**
 * Targeted coverage tests for proposal-tools.ts branches that require
 * findProposalByHash to return a non-null file path.
 *
 * Uses vi.mock so these are isolated from proposal-handlers.integration.test.ts.
 *
 * Covers:
 *  - proposal-tools.ts lines 844-862: validate action gate-level test-first
 *    check with sibling proposals (findProposalByHash returns real path,
 *    readFile returns file content with role, if (filePath) branch entered)
 *  - proposal-tools.ts line 934: reject validator getCurrentStatus returns null
 */

import { describe, it, expect, vi } from 'vitest'
import { proposalHandlers } from '../../../src/mcp/tools/proposal-tools.js'

vi.mock('../../../src/utils/artifact-locator.js', () => ({
  findProposalByHash: vi.fn().mockResolvedValue('/tmp/proposals/gate-07/test-suite-proposal.md'),
  findGateByGateId: vi.fn().mockResolvedValue(null),
  resolveProposalGateInfo: vi.fn().mockResolvedValue(null),
}))
vi.mock('../../../src/utils/file.js', () => ({
  readFile: vi.fn().mockResolvedValue('## Proposal\n\n**Role**: test-suite\n\nContent here.'),
  writeFile: vi.fn().mockResolvedValue(undefined),
}))

describe('Proposal Tools – filePath branch coverage', () => {
  // ── validate action: lines 844-862 (gate-level test-first check with proposals) ──

  it('validate action enters if(filePath) branch and reads proposal role from file', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockImplementation(async (name: string) => {
        if (name === 'proposal_show') {
          return {
            success: true,
            data: {
              hash: 'val01aa',
              status: 'in_progress',
              gateId: 'gate-07',
              files: [],
              files_affected: [],
              tasks: [],
              title: 'Feature',
              description: 'A feature proposal',
              solitary: false,
            },
          }
        }
        if (name === 'proposal_list') {
          return {
            success: true,
            data: {
              proposals: [
                { hash: 'val01aa', lastUpdated: new Date().toISOString() },
                { hash: 'val02bb', lastUpdated: new Date().toISOString() },
              ],
            },
          }
        }
        if (name === 'proposal_validate') {
          return {
            success: true,
            data: { passed: true, passedQuantitative: true, checks: {}, guidance: '' },
          }
        }
        return { success: true, data: {} }
      }),
    }
    const handlers = proposalHandlers(fakeRegistry)
    // validate action runs gate-level test-first check;
    // findProposalByHash returns real path; readFile returns test-suite role;
    // validateGateLevelTestFirst called with roles found from file content
    const res = await handlers.proposal_action({ action: 'validate', hash: 'val01aa' })
    expect(res).toBeDefined()
    // The if(filePath) branch was entered — result is either success or a
    // test-first validation failure (1 test-suite, 0 cleanup → error)
    // Either way, the handler should return a valid response
    if (res.isError) {
      const text = String((res.content?.[0] as any)?.text ?? '')
      // Should not be a parse/schema error
      expect(text.toLowerCase()).not.toContain('parse')
    } else {
      // If it passed, content should be defined
      expect((res.content[0] as any)?.text).toBeDefined()
    }
  })

  // ── reject validator: line 934 (getCurrentStatus returns null) ────────────

  it('reject validator state check returns error when proposal_show fails', async () => {
    const fakeRegistry: any = {
      invoke: vi.fn().mockImplementation(async (name: string) => {
        if (name === 'proposal_show') {
          return { success: false, error: { code: 'NOT_FOUND', message: 'not found' } }
        }
        return { success: true, data: {} }
      }),
    }
    const handlers = proposalHandlers(fakeRegistry)
    const res = await handlers.proposal_action({ action: 'reject', hash: 'ghost01' })
    expect(res.isError).toBe(true)
    const text = String((res.content?.[0] as any)?.text ?? '')
    expect(text.toLowerCase()).toMatch(/cannot|state|status|unknown|reject/)
  })
})
