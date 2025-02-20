export interface Record {
  uri: string
  cid: string
  did: string
  collection: string
  rkey: string
}

export const tableName = 'record'

export type PartialDB = { [tableName]: Record }
