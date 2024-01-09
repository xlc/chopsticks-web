import React, { useCallback, useEffect, useState } from 'react'
import { Button, Divider, Form, Input, Spin, Typography, FormProps } from 'antd'
import { decodeBlockStorageDiff, setStorage, setup, Block, ChopsticksProvider } from '@acala-network/chopsticks-core'
import { IdbDatabase } from '@acala-network/chopsticks-db/browser'
import { create } from 'jsondiffpatch'
import _ from 'lodash'
import { ApiPromise } from '@polkadot/api'

import { Api } from './types'
import DiffViewer from './DiffViewer'
import { compactAddLength } from '@polkadot/util'
import { ArgsCell } from './components'
import { callToHuman } from './helper'

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

if (import.meta.env.DEV) {
  // @ts-expect-error TODO: this is to workaround chopsticks issue on web worker
  import('@acala-network/chopsticks-core/wasm-executor/browser-wasm-executor')
}

export type DryRunProps = {
  api: Api
  endpoint: string
  preimage?: { hex: string; origin: any }
  extrinsicMode?: boolean
}

const rootOrigin = { system: 'Root' }

const parseOrigin = (value: string) => {
  try {
    return JSON.parse(value)
  } catch (e) {
    return undefined
  }
}

const decodeCall = (api: Api, data: any) => {
  try {
    return api.registry.createType('Call', data)
  } catch (_e) {
    return undefined
  }
}

const DryRun: React.FC<DryRunProps> = ({ api, endpoint, preimage: defaultPreimage, extrinsicMode }) => {
  const [form] = Form.useForm()
  const [message, setMessage] = useState<string>()
  const [isLoading, setIsLoading] = useState(false)
  const [storageDiff, setStorageDiff] = useState<Awaited<ReturnType<typeof decodeStorageDiff>>>()
  const [call, setCall] = useState<any>()
  const [dryRunOutcome, setDryRunOutcome] = useState<string>()

  const onFinish = useCallback(
    async (values: any) => {
      const { preimage, origin } = values

      if (!preimage) {
        return
      }

      setIsLoading(true)
      setStorageDiff(undefined)
      setDryRunOutcome('')
      setMessage('Starting')

      const decoded = decodeCall(api, preimage)

      if (!decoded) {
        setIsLoading(false)
        setMessage('Invalid preimage')
        return
      }

      const blockNumber = ((await api.query.system.number()) as any).toNumber()
      const chain = await setup({
        endpoint,
        block: blockNumber,
        mockSignatureHost: true,
        db: new IdbDatabase('cache'),
      })

      setMessage('Chopsticks instance created')

      const dryRunExtrinsic = async () => {
        try {
          // Give Alice some funds
          await setStorage(chain, {
            system: {
              account: [
                [
                  ['5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'],
                  {
                    providers: 1,
                    data: {
                      free: '1000000000000',
                    },
                  },
                ],
              ],
            },
          })
        } catch (e) {
          console.log('Enable to override Alice balances', e)
        }

        const res = await chain.dryRunExtrinsic({
          call: preimage,
          address: origin,
        })
        const diff = res.storageDiff

        setDryRunOutcome(JSON.stringify(res.outcome.toHuman()))

        setMessage('Dry run completed. Preparing diff...')

        return await decodeStorageDiff(chain.head, diff as any)
      }

      const dryRunPreimage = async () => {
        const oldHead = chain.head
        const originJson = parseOrigin(origin)

        const preimageHash = decoded.hash.toHex()
        const len = decoded.encodedLength
        try {
          await setStorage(chain, {
            preimage: {
              preimageFor: [[[[preimageHash, decoded.encodedLength]], compactAddLength(decoded.toU8a())]],
            },
            scheduler: {
              agenda: [
                [
                  [blockNumber + 1],
                  [
                    {
                      call: {
                        Lookup: {
                          hash: preimageHash,
                          len,
                        },
                      },
                      origin: originJson,
                    },
                  ],
                ],
              ],
            },
          })
        } catch (e) {
          console.error(e)
          setMessage('Invalid parameters')
          setIsLoading(false)
          return
        }

        await chain.newBlock()

        setMessage('Dry run completed. Preparing diff...')

        const diff = await chain.head.storageDiff()

        return await decodeStorageDiff(oldHead, Object.entries(diff) as any)
      }

      const storgaeDiff = extrinsicMode ? await dryRunExtrinsic() : await dryRunPreimage()
      setStorageDiff(storgaeDiff)

      const provider = new ChopsticksProvider(chain)
      const chopsticksApi = new ApiPromise({ provider, noInitWarn: true })

      console.log('Chopsticks chain', chain)
      console.log('Last head', chain.head)
      console.log('Chopsticks api', chopsticksApi)

      setMessage('')
      setIsLoading(false)
    },
    [api, endpoint, extrinsicMode],
  )

  useEffect(() => {
    const originInitialValue = extrinsicMode
      ? '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
      : JSON.stringify(rootOrigin)
    form.setFieldValue('preimage', defaultPreimage?.hex)
    form.setFieldValue(
      'origin',
      defaultPreimage ? JSON.stringify(defaultPreimage.origin ?? rootOrigin) : originInitialValue,
    )
    if (defaultPreimage?.hex) {
      const decoded = decodeCall(api, defaultPreimage?.hex)
      if (decoded) {
        const data = `${decoded.section}.${decoded.method}\n${callToHuman(decoded)}`
        setCall(data)
      } else {
        setCall(undefined)
      }
    }
  }, [api, defaultPreimage, extrinsicMode, form])

  const onFieldsChange = useCallback(
    (changedFields: Parameters<NonNullable<FormProps['onFieldsChange']>>[0]) => {
      for (const field of changedFields) {
        if (field.name[0] === 'preimage') {
          const decoded = decodeCall(api, field.value)
          if (decoded) {
            const data = `${decoded.section}.${decoded.method}\n${callToHuman(decoded)}`
            setCall(data)
          } else {
            setCall(undefined)
          }
        }
      }
    },
    [api, setCall],
  )

  return (
    <div>
      <Form form={form} onFinish={onFinish} disabled={isLoading} onFieldsChange={onFieldsChange}>
        <Form.Item
          label={extrinsicMode ? 'extrinsic' : 'preimage'}
          name="preimage"
          rules={[{ required: true, pattern: /^0x[\da-f]+$/i, message: 'Not a hex value with 0x prefix' }]}
        >
          <Input pattern="0x[0-9a-fA-F]+" />
        </Form.Item>
        <Form.Item>
          {call ? (
            <Typography.Text>
              <ArgsCell style={{ maxHeight: 200 }}>{call}</ArgsCell>
            </Typography.Text>
          ) : (
            <Typography.Text type="danger">Invalid Call</Typography.Text>
          )}
        </Form.Item>
        <Form.Item label="origin" name="origin" required>
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
          <Typography.Text>{dryRunOutcome}</Typography.Text>
        </Form.Item>
      </Form>
      <Divider />
      {storageDiff && <DiffViewer {...storageDiff} />}
    </div>
  )
}

const DryRunFC = React.memo(DryRun)

export default DryRunFC
