import React, { useCallback, useState } from 'react'
import { Button, Divider, Form, Input, Spin, Typography } from 'antd'
import { decodeBlockStorageDiff, setup, Block, ChopsticksProvider } from '@acala-network/chopsticks-core'
import { IdbDatabase } from '@acala-network/chopsticks-db/browser'
import { create } from 'jsondiffpatch'
import _ from 'lodash'
import { ApiPromise } from '@polkadot/api'

import { Api } from './types'
import DiffViewer from './DiffViewer'
import { ArgsCell } from './components'

const diffPatcher = create({
  arrays: { detectMove: false },
  textDiff: { minLength: Number.MAX_VALUE } as any, // skip text diff
})

const decodeStorageDiff = async (block: Block, diff: [string, string | null][]) => {
  const [oldState, newState] = await decodeBlockStorageDiff(block, diff as any)
  const oldStateWithoutEvents = _.cloneDeep(oldState) as any
  if (oldStateWithoutEvents['system']?.['events']) {
    oldStateWithoutEvents['system']['events'] = []
  }
  return { oldState, newState, delta: diffPatcher.diff(oldStateWithoutEvents, newState) }
}

if (import.meta.env.DEV) {
  // @ts-expect-error TODO: this is to workaround chopsticks issue on web worker
  import('@acala-network/chopsticks-core/wasm-executor/browser-wasm-executor')
}

export type StateCallProps = {
  api: Api
  endpoint: string
}

const StateCall: React.FC<StateCallProps> = ({ api, endpoint }) => {
  const [form] = Form.useForm()
  const [message, setMessage] = useState<string>()
  const [isLoading, setIsLoading] = useState(false)
  const [storageDiff, setStorageDiff] = useState<Awaited<ReturnType<typeof decodeStorageDiff>>>()
  const [dryRunOutcome, setDryRunOutcome] = useState<string>()

  const onFinish = useCallback(
    async (values: any) => {
      const { call, args, argsType, retType } = values

      if (!call) {
        return
      }

      setIsLoading(true)
      setStorageDiff(undefined)
      setDryRunOutcome('')
      setMessage('Starting')

      const blockNumber = ((await api.query.system.number()) as any).toNumber()
      const chain = await setup({
        endpoint,
        block: blockNumber,
        mockSignatureHost: true,
        db: new IdbDatabase('cache'),
        runtimeLogLevel: 5,
      })

      setMessage('Chopsticks instance created')

      const dryRun = async () => {
        try {
          const parsedArgs = api.registry.createType(argsType, JSON.parse(args))
          const res = await chain.head.call(call, [parsedArgs.toHex()])
          const diff = res.storageDiff

          console.log('Result', res)

          setDryRunOutcome(JSON.stringify(api.registry.createType(retType, res.result).toJSON(), null, 2))

          setMessage('Dry run completed. Preparing diff...')

          return await decodeStorageDiff(chain.head, diff)
        } catch (e: any) {
          console.error(e)
          return undefined
        }
      }

      const dryRunDiff = await dryRun()
      if (dryRunDiff) {
        setStorageDiff(dryRunDiff)

        const provider = new ChopsticksProvider(chain)
        const chopsticksApi = new ApiPromise({ provider, noInitWarn: true })

        console.log('Chopsticks chain', chain)
        console.log('Last head', chain.head)
        console.log('Chopsticks api', chopsticksApi)

        setMessage('')
      } else {
        setMessage('Invalid parameters')
      }

      setIsLoading(false)
    },
    [api.query.system, api.registry, endpoint],
  )

  return (
    <div>
      <Form form={form} onFinish={onFinish} disabled={isLoading}>
        <Form.Item label="call" name="call" required initialValue="Core_version">
          <Input />
        </Form.Item>
        <Form.Item label="args types" name="argsType" required initialValue="()">
          <Input />
        </Form.Item>
        <Form.Item label="args" name="args" initialValue="[]">
          <Input />
        </Form.Item>
        <Form.Item label="ret type" name="retType" required initialValue="RuntimeVersion">
          <Input />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">
            Run
          </Button>
        </Form.Item>
        <Form.Item>
          <Spin spinning={isLoading} />
          &nbsp;&nbsp;
          <Typography.Text>{message}</Typography.Text>
          &nbsp;&nbsp;
          <Typography.Text>
            <ArgsCell>{dryRunOutcome}</ArgsCell>
          </Typography.Text>
        </Form.Item>
      </Form>
      <Divider />
      {storageDiff && <DiffViewer {...storageDiff} />}
    </div>
  )
}

const StateCallFC = React.memo(StateCall)

export default StateCallFC
