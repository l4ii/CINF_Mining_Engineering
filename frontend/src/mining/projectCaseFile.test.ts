import { describe, expect, it } from 'vitest'
import { createCandidate, createEmptyProject, createOreBody } from './project'
import {
  buildProjectCaseFileName,
  buildProjectCaseFileText,
  importProjectCases,
  parseProjectCasePayload,
  PROJECT_CASE_FILE_EXT,
  PROJECT_CASE_FILE_TYPE,
  readProjectCaseFile,
} from './projectCaseFile'

describe('mining project case file', () => {
  it('serializes a wrapped case payload and clones ids on import', () => {
    const candidate = createCandidate({ id: 'method-old', methodName: '上向进路充填法', calculated: true })
    const project = {
      ...createEmptyProject('东区试验矿', 1),
      id: 'project-old',
      oreDensity: 2.7,
      wasteDensity: 2.6,
      oreBodies: [
        createOreBody({
          id: 'orebody-old',
          name: '1号矿体',
          dipAngle: 35,
          thickness: 3,
          candidates: [candidate],
          selectedCandidateId: candidate.id,
        }),
      ],
    }

    const parsed = parseProjectCasePayload(JSON.parse(buildProjectCaseFileText(project)))
    expect(parsed).toHaveLength(1)
    expect(parsed[0].name).toBe('东区试验矿')
    expect(parsed[0].id).toBe('project-old')
    expect(parsed[0].oreBodies[0].selectedCandidateId).toBe('method-old')

    const imported = importProjectCases(parsed, 100)
    expect(imported[0].id).not.toBe('project-old')
    expect(imported[0].oreBodies[0].id).not.toBe('orebody-old')
    expect(imported[0].oreBodies[0].candidates[0].id).not.toBe('method-old')
    expect(imported[0].oreBodies[0].selectedCandidateId).toBe(imported[0].oreBodies[0].candidates[0].id)
    expect(imported[0].updatedAt).toBe(100)
    expect(buildProjectCaseFileName(project)).toBe(`东区试验矿${PROJECT_CASE_FILE_EXT}`)
  })

  it('accepts a projects array and a bare project object', () => {
    const wrapped = parseProjectCasePayload({
      type: PROJECT_CASE_FILE_TYPE,
      projects: [
        { name: '甲矿', oreBodies: [] },
        { name: '乙矿', oreBodies: [] },
      ],
    })
    expect(wrapped.map((item) => item.name)).toEqual(['甲矿', '乙矿'])

    const bare = parseProjectCasePayload({ name: '裸项目', location: '湖南', oreBodies: [] })
    expect(bare).toHaveLength(1)
    expect(bare[0].location).toBe('湖南')
    expect(parseProjectCasePayload({ name: '不是项目' })).toEqual([])
  })

  it('reads a File and rejects invalid json', async () => {
    const file = new File(
      [buildProjectCaseFileText(createEmptyProject('导入矿'))],
      `导入矿${PROJECT_CASE_FILE_EXT}`,
      { type: 'application/json' },
    )
    const parsed = await readProjectCaseFile(file)
    expect(parsed[0].name).toBe('导入矿')

    await expect(readProjectCaseFile(new File(['{'], '坏.cinfmine'))).rejects.toThrow()
  })
})
