import { CID } from 'multiformats'
import { Fanout, IpldStore, MST, NodeEntry } from '../src'
import * as util from './_util'
import fs from 'fs'

type BenchmarkData = {
  fanout: number
  size: number
  addTime: string
  saveTime: string
  walkTime: string
  depth: number
  maxWidth: number
  widths: Record<number, number>
}

describe('MST Benchmarks', () => {
  let mapping: Record<string, CID>
  let shuffled: [string, CID][]

  const size = 100000

  beforeAll(async () => {
    mapping = await util.generateBulkTidMapping(size)
    shuffled = util.shuffle(Object.entries(mapping))
  })

  const fanouts: Fanout[] = [2, 8, 16, 32, 64]
  it('benchmarks various fanouts', async () => {
    let benches: BenchmarkData[] = []
    for (const fanout of fanouts) {
      const blockstore = IpldStore.createInMemory()
      let mst = await MST.create(blockstore, [], { fanout })

      const start = Date.now()

      for (const entry of shuffled) {
        mst = await mst.add(entry[0], entry[1])
      }

      const doneAdding = Date.now()

      const root = await mst.save()

      const doneSaving = Date.now()

      let reloaded = await MST.fromCid(blockstore, root, { fanout })
      const widthTracker = new NodeWidths()
      for await (const entry of reloaded.walk()) {
        await widthTracker.trackEntry(entry)
      }

      const doneWalking = Date.now()

      benches.push({
        fanout,
        size,
        addTime: secDiff(start, doneAdding),
        saveTime: secDiff(doneAdding, doneSaving),
        walkTime: secDiff(doneSaving, doneWalking),
        depth: await mst.getLayer(),
        maxWidth: widthTracker.max,
        widths: widthTracker.data,
      })
    }
    writeBenchData(benches, 'mst-benchmarks')
  })
})

const secDiff = (first: number, second: number): string => {
  return ((second - first) / 1000).toFixed(3)
}

class NodeWidths {
  data = {
    0: 0,
    16: 0,
    32: 0,
    48: 0,
    64: 0,
    96: 0,
    128: 0,
    160: 0,
    192: 0,
    224: 0,
    256: 0,
  }
  max = 0

  async trackEntry(entry: NodeEntry) {
    if (!entry.isTree()) return
    const entries = await entry.getEntries()
    const width = entries.filter((e) => e.isLeaf()).length
    this.max = Math.max(this.max, width)
    if (width >= 0) this.data[0]++
    if (width >= 16) this.data[16]++
    if (width >= 32) this.data[32]++
    if (width >= 48) this.data[48]++
    if (width >= 64) this.data[64]++
    if (width >= 96) this.data[96]++
    if (width >= 128) this.data[128]++
    if (width >= 160) this.data[160]++
    if (width >= 192) this.data[192]++
    if (width >= 224) this.data[224]++
    if (width >= 256) this.data[256]++
  }
}

const writeBenchData = (benches: BenchmarkData[], fileLoc: string) => {
  let toWrite = ''
  for (const bench of benches) {
    toWrite += `Fanout: ${bench.fanout}
----------------------
Time to add ${bench.size} leaves: ${bench.addTime}s
Time to save tree with ${bench.size} leaves: ${bench.saveTime}s
Time to reconstruct & walk ${bench.size} leaves: ${bench.walkTime}s
Tree depth: ${bench.depth}
Max Node Width (only counting leaves): ${bench.maxWidth}
Nodes with >= 0 leaves: ${bench.widths[0]}
Nodes with >= 16 leaves: ${bench.widths[16]}
Nodes with >= 32 leaves: ${bench.widths[32]}
Nodes with >= 48 leaves: ${bench.widths[48]}
Nodes with >= 64 leaves: ${bench.widths[64]}
Nodes with >= 96 leaves: ${bench.widths[96]}
Nodes with >= 128 leaves: ${bench.widths[128]}
Nodes with >= 160 leaves: ${bench.widths[160]}
Nodes with >= 192 leaves: ${bench.widths[192]}
Nodes with >= 224 leaves: ${bench.widths[224]}
Nodes with >= 256 leaves: ${bench.widths[256]}


`
  }
  fs.writeFileSync(fileLoc, toWrite)
}
