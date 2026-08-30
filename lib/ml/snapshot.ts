import type { MlProductItem, MlProductItemsResponse } from './types'

export const ML_PRODUCT_ITEMS_PAGE_LIMIT = 100
export const ML_PRODUCT_ITEMS_MAX_TOTAL = 10_000

export type MlSnapshotRejectionReason =
  | 'invalid_item_id'
  | 'invalid_seller_id'
  | 'invalid_price'
  | 'invalid_currency'
  | 'invalid_condition'

export type MlSnapshotItem =
  | { kind: 'valid'; item: MlProductItem; mlRank: number }
  | {
      kind: 'invalid'
      itemId: string
      mlRank: number
      reason: Exclude<MlSnapshotRejectionReason, 'invalid_item_id'>
    }

type MlSnapshotBase = {
  totalReceived: number
  pagesFetched: number
  rejectedByReason: Record<MlSnapshotRejectionReason, number>
}

export type MlProductItemsSnapshot =
  | (MlSnapshotBase & {
      status: 'success'
      items: MlSnapshotItem[]
    })
  | (MlSnapshotBase & {
      status: 'success_empty'
      items: MlSnapshotItem[]
    })
  | (MlSnapshotBase & {
      status: 'upstream_error'
      reason: 'request_failed'
    })
  | (MlSnapshotBase & {
      status: 'snapshot_invalid'
      reason: 'request_failed' | 'invalid_paging' | 'snapshot_too_large' | 'incomplete_page' | 'duplicate_conflict'
    })

export type GetProductItemsPage = (
  catalogId: string,
  options: { offset: number; limit: number },
) => Promise<MlProductItemsResponse>

type ValidatedItem = {
  kind: 'valid'
  item: MlProductItem
  mlRank: number
  fingerprint: string
}

type InvalidItem = {
  kind: 'invalid'
  itemId: string
  mlRank: number
  reason: Exclude<MlSnapshotRejectionReason, 'invalid_item_id'>
  fingerprint: string
}

type CandidateItem = ValidatedItem | InvalidItem | null

function newCounters(): Record<MlSnapshotRejectionReason, number> {
  return {
    invalid_item_id: 0,
    invalid_seller_id: 0,
    invalid_price: 0,
    invalid_currency: 0,
    invalid_condition: 0,
  }
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function isValidItemId(value: unknown): value is string {
  return typeof value === 'string' && /^MLB\d{6,}$/.test(value)
}

function fingerprint(item: Record<string, unknown>): string {
  return JSON.stringify([
    item.seller_id,
    item.price,
    item.currency_id,
    item.condition,
  ])
}

function validateItem(
  value: unknown,
  mlRank: number,
  rejectedByReason: Record<MlSnapshotRejectionReason, number>,
): CandidateItem {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    rejectedByReason.invalid_item_id++
    return null
  }

  const item = value as Record<string, unknown>
  if (!isValidItemId(item.item_id)) {
    rejectedByReason.invalid_item_id++
    return null
  }

  const itemId = item.item_id
  const itemFingerprint = fingerprint(item)
  if (!isPositiveInteger(item.seller_id)) {
    rejectedByReason.invalid_seller_id++
    return { kind: 'invalid', itemId, mlRank, reason: 'invalid_seller_id', fingerprint: itemFingerprint }
  }
  if (typeof item.price !== 'number' || !Number.isFinite(item.price) || item.price <= 0) {
    rejectedByReason.invalid_price++
    return { kind: 'invalid', itemId, mlRank, reason: 'invalid_price', fingerprint: itemFingerprint }
  }
  if (item.currency_id !== 'BRL') {
    rejectedByReason.invalid_currency++
    return { kind: 'invalid', itemId, mlRank, reason: 'invalid_currency', fingerprint: itemFingerprint }
  }
  if (item.condition !== 'new') {
    rejectedByReason.invalid_condition++
    return { kind: 'invalid', itemId, mlRank, reason: 'invalid_condition', fingerprint: itemFingerprint }
  }

  return {
    kind: 'valid',
    item: value as MlProductItem,
    mlRank,
    fingerprint: itemFingerprint,
  }
}

function hasValidPaging(response: MlProductItemsResponse): boolean {
  const paging = response?.paging
  return Boolean(
    paging &&
      Number.isSafeInteger(paging.total) &&
      paging.total >= 0 &&
      Number.isSafeInteger(paging.offset) &&
      paging.offset >= 0 &&
      Number.isSafeInteger(paging.limit) &&
      paging.limit > 0 &&
      Array.isArray(response.results),
  )
}

export async function collectMlProductItemsSnapshot(
  catalogId: string,
  getPage: GetProductItemsPage,
): Promise<MlProductItemsSnapshot> {
  const rejectedByReason = newCounters()
  const candidates: CandidateItem[] = []
  let totalReceived = 0
  let pagesFetched = 0
  let total: number | null = null
  let offset = 0

  while (total === null || offset < total) {
    let response: MlProductItemsResponse
    try {
      response = await getPage(catalogId, { offset, limit: ML_PRODUCT_ITEMS_PAGE_LIMIT })
    } catch {
      return {
        status: 'upstream_error',
        reason: 'request_failed',
        totalReceived,
        pagesFetched,
        rejectedByReason,
      }
    }

    pagesFetched++
    if (!hasValidPaging(response) || response.paging.offset !== offset) {
      return {
        status: 'snapshot_invalid',
        reason: 'invalid_paging',
        totalReceived,
        pagesFetched,
        rejectedByReason,
      }
    }

    if (total === null) {
      total = response.paging.total
      if (total > ML_PRODUCT_ITEMS_MAX_TOTAL) {
        return {
          status: 'snapshot_invalid',
          reason: 'snapshot_too_large',
          totalReceived,
          pagesFetched,
          rejectedByReason,
        }
      }
    } else if (response.paging.total !== total) {
      return {
        status: 'snapshot_invalid',
        reason: 'invalid_paging',
        totalReceived,
        pagesFetched,
        rejectedByReason,
      }
    }

    const expectedItems = Math.min(response.paging.limit, total - offset)
    if (response.results.length !== expectedItems) {
      return {
        status: 'snapshot_invalid',
        reason: 'incomplete_page',
        totalReceived,
        pagesFetched,
        rejectedByReason,
      }
    }

    for (let index = 0; index < response.results.length; index++) {
      totalReceived++
      candidates.push(validateItem(response.results[index], offset + index, rejectedByReason))
    }

    if (total === 0 || offset + response.paging.limit >= total) break
    offset += response.paging.limit
  }

  if (total === null || totalReceived !== total) {
    return {
      status: 'snapshot_invalid',
      reason: 'incomplete_page',
      totalReceived,
      pagesFetched,
      rejectedByReason,
    }
  }

  const uniqueItems = new Map<string, ValidatedItem | InvalidItem>()
  for (const candidate of candidates) {
    if (candidate === null) continue
    const existing = uniqueItems.get(candidate.kind === 'valid' ? candidate.item.item_id : candidate.itemId)
    if (!existing) {
      uniqueItems.set(candidate.kind === 'valid' ? candidate.item.item_id : candidate.itemId, candidate)
      continue
    }
    if (existing.fingerprint !== candidate.fingerprint || existing.kind !== candidate.kind) {
      return {
        status: 'snapshot_invalid',
        reason: 'duplicate_conflict',
        totalReceived,
        pagesFetched,
        rejectedByReason,
      }
    }
  }

  const items: MlSnapshotItem[] = [...uniqueItems.values()].map(item => {
    if (item.kind === 'valid') {
      return { kind: 'valid', item: item.item, mlRank: item.mlRank }
    }
    return {
      kind: 'invalid',
      itemId: item.itemId,
      mlRank: item.mlRank,
      reason: item.reason,
    }
  })
  return {
    status: total === 0 ? 'success_empty' : 'success',
    items,
    totalReceived,
    pagesFetched,
    rejectedByReason,
  }
}
