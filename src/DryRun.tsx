import React, { useCallback, useState } from 'react'

import { Button, Divider, Form, Input, Spin, Typography } from 'antd'
import { decodeBlockStorageDiff, setStorage, setup, Block } from '@acala-network/chopsticks-core'
import { IdbDatabase } from '@acala-network/chopsticks-db/browser'
import { create } from 'jsondiffpatch'
import _ from 'lodash'

import { Api } from './types'
import DiffViewer from './DiffViewer'

const diffPatcher = create({
  array: { detectMove: false },
  textDiff: { minLength: Number.MAX_VALUE }, // skip text diff
})

const decodeStorageDiff = async (block: Block, diff: [string, string | null][]) => {
  const [oldState, newState] = await decodeBlockStorageDiff(block, diff as any)
  const oldStateWithoutEvents = _.cloneDeep(oldState) as any
  if (oldStateWithoutEvents['system']?.['events']) {
    oldStateWithoutEvents['system']['events'] = []
  }
  return { oldState, newState, delta: diffPatcher.diff(oldStateWithoutEvents, newState) }
}

// TODO: workaround chopsticks issue on web worker
import '@acala-network/chopsticks-core/wasm-executor/browser-wasm-executor?worker&url'

export type DryRunProps = {
  api: Api
  endpoint: string
}

const rootOrigin = { system: 'Root' }

const parseJson = (value: string) => {
  try {
    return JSON.parse(value)
  } catch (e) {
    return undefined
  }
}

const DryRun: React.FC<DryRunProps> = ({ api, endpoint }) => {
  const [message, setMessage] = useState<string>()
  const [isLoading, setIsLoading] = useState(false)
  const [storageDiff, setStorageDiff] = useState<Awaited<ReturnType<typeof decodeStorageDiff>>>()

  const onFinish = useCallback(
    async (values: any) => {
      const { preimage, origin } = values
      const originJson = parseJson(origin)

      if (!preimage || !originJson) {
        return
      }

      setIsLoading(true)
      setStorageDiff(undefined)
      setMessage('Starting')

      const blockNumber = ((await api.query.system.number()) as any).toNumber()
      const chain = await setup({
        endpoint,
        block: blockNumber,
        mockSignatureHost: true,
        db: new IdbDatabase('cache'),
      })

      setMessage('Chopsticks instance created')

      await setStorage(chain, {
        scheduler: {
          agenda: [
            [
              [blockNumber + 1],
              [
                {
                  call: {
                    inline: preimage,
                  },
                  origin: originJson,
                },
              ],
            ],
          ],
        },
      })

      await chain.newBlock()

      setMessage('Dry run completed')

      const diff = await chain.head.storageDiff()

      setIsLoading(false)

      const storgaeDiff = await decodeStorageDiff(chain.head, Object.entries(diff) as any)
      setStorageDiff(storgaeDiff)
    },
    [api, endpoint, setIsLoading, setMessage, setStorageDiff],
  )

  return (
    <div>
      <Form onFinish={onFinish} disabled={isLoading}>
        <Form.Item
          label="preimage"
          name="preimage"
          rules={[{ required: true, pattern: /^0x[\da-f]+$/i, message: 'Not a hex value with 0x prefix' }]}
        >
          <Input pattern="0x[0-9a-fA-F]+" />
        </Form.Item>
        <Form.Item label="origin" name="origin" required initialValue={JSON.stringify(rootOrigin)}>
          <Input />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">
            Run
          </Button>
        </Form.Item>
        <Form.Item>
          <Typography.Text>{message}</Typography.Text>
          <Spin spinning={isLoading} />
        </Form.Item>
      </Form>
      <Divider />
      { storageDiff && <DiffViewer {...storageDiff} /> }
    </div>
  )
}

const DryRunFC = React.memo(DryRun)

export default DryRunFC
