import { describe, expect, it, vi } from 'vitest'

import {
  createIngestionRun,
  type IngestionRunStore,
} from './ingestion-run'

const runId = '0199243f-5418-7e26-8d7e-6068e98a5970'

describe('ingestion run repository', () => {
  it('creates a run with a stable idempotency key and item list', async () => {
    const create = vi.fn(async () => ({ data: runId, error: null }))
    const store: IngestionRunStore = { create }

    await expect(createIngestionRun({
      ingestionType: 'ml_catalog',
      idempotencyKey: '2026-09-02',
      triggerSource: 'cron',
      itemKeys: ['MLB_A', 'MLB_B'],
      codeVersion: 'ecfef4c',
    }, store)).resolves.toBe(runId)

    expect(create).toHaveBeenCalledWith({
      p_ingestion_type: 'ml_catalog',
      p_idempotency_key: '2026-09-02',
      p_trigger_source: 'cron',
      p_item_keys: ['MLB_A', 'MLB_B'],
      p_code_version: 'ecfef4c',
    })
  })

  it('sends a missing code version as null', async () => {
    const create = vi.fn(async () => ({ data: runId, error: null }))

    await createIngestionRun({
      ingestionType: 'ml_catalog',
      idempotencyKey: 'manual-1',
      triggerSource: 'manual',
      itemKeys: ['MLB_A'],
    }, { create })

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      p_code_version: null,
    }))
  })

  it('sanitizes storage errors', async () => {
    const store: IngestionRunStore = {
      create: vi.fn(async () => ({
        data: null,
        error: new Error('database-secret-must-not-leak'),
      })),
    }

    await expect(createIngestionRun({
      ingestionType: 'ml_catalog',
      idempotencyKey: '2026-09-02',
      triggerSource: 'cron',
      itemKeys: ['MLB_A'],
    }, store)).rejects.toThrowError('INGESTION_RUN_CREATE_FAILED')
  })

  it.each([null, 42, 'not-a-uuid'])('rejects invalid run ids: %s', async data => {
    const store: IngestionRunStore = {
      create: vi.fn(async () => ({ data, error: null })),
    }

    await expect(createIngestionRun({
      ingestionType: 'ml_catalog',
      idempotencyKey: '2026-09-02',
      triggerSource: 'cron',
      itemKeys: ['MLB_A'],
    }, store)).rejects.toThrowError('INGESTION_RUN_INVALID_ID')
  })
})

