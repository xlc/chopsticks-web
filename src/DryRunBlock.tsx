import { ChopsticksProvider, setup } from '@acala-network/chopsticks-core'
import { IdbDatabase } from '@acala-network/chopsticks-db/browser'
import { ApiPromise } from '@polkadot/api'
import { Button, Divider, Form, Input, Space, Spin, Typography } from 'antd'
import React, { useCallback, useState } from 'react'

import DiffViewer from './DiffViewer'
import { decodeStorageDiff } from './helper'
import type { Api } from './types'

export type DryRunBlockProps = {
  api: Api
  endpoint: string
}

const DryRunBlock: React.FC<DryRunBlockProps> = ({ api, endpoint }) => {
  const [form] = Form.useForm()
  const [message, setMessage] = useState<string>()
  const [isLoading, setIsLoading] = useState(false)
  const [storageDiff, setStorageDiff] = useState<Awaited<ReturnType<typeof decodeStorageDiff>>>()

  const onFinish = useCallback(
    async (values: any) => {
      const { extrinsics, dmp, ump, hrmp } = values

      setIsLoading(true)
      setStorageDiff(undefined)
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
          const umpMessages: Record<number, any> = {}
          for (const item of ump ?? []) {
            umpMessages[item.paraId] = umpMessages[item.paraId] ?? []
            umpMessages[item.paraId].push(item.message)
          }
          const hrmpMessages: Record<number, any> = {}
          for (const item of hrmp ?? []) {
            hrmpMessages[item.paraId] = hrmpMessages[item.paraId] ?? []
            hrmpMessages[item.paraId].push({
              sendAt: item.sendAt,
              data: item.message,
            })
          }

          const block = await chain.newBlock({
            transactions: extrinsics,
            downwardMessages: dmp,
            upwardMessages: umpMessages,
            horizontalMessages: hrmpMessages,
          })

          setMessage('Dry run completed. Preparing diff...')

          const diff = await block.storageDiff()

          return await decodeStorageDiff(chain.head, Object.entries(diff) as any)
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
    [api.query.system, endpoint],
  )

  return (
    <div>
      <Form form={form} onFinish={onFinish} disabled={isLoading}>
        <Form.Item label="Extrinsics">
          <Form.List name="extrinsics">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => (
                  <Form.Item key={field.key} required>
                    <Input style={{ width: '85%' }} placeholder="Encoded extrinsic" required />
                    <Button type="link" onClick={() => remove(index)}>
                      Remove
                    </Button>
                  </Form.Item>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block>
                    Add Extrinsic
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        </Form.Item>
        <Form.Item label="DMP">
          <Form.List name="dmp">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => (
                  <Form.Item key={field.key} required>
                    <Input style={{ width: '85%' }} required />
                    <Button type="link" onClick={() => remove(index)}>
                      Remove
                    </Button>
                  </Form.Item>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block>
                    Add DMP Item
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        </Form.Item>
        <Form.Item label="UMP">
          <Form.List name="ump">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => (
                  <Form.Item key={field.key} required>
                    <Space.Compact block>
                      <Form.Item name={[field.name, 'paraId']} noStyle required>
                        <Input type="number" style={{ width: '15%' }} placeholder="ParaId" required />
                      </Form.Item>
                      <Form.Item name={[field.name, 'message']} noStyle required>
                        <Input style={{ width: '85%' }} placeholder="Encoded message" required />
                      </Form.Item>
                    </Space.Compact>
                    <Button type="link" onClick={() => remove(index)}>
                      Remove
                    </Button>
                  </Form.Item>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block>
                    Add UMP Item
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        </Form.Item>
        <Form.Item label="HRMP">
          <Form.List name="hrmp">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => (
                  <Form.Item key={field.key} required>
                    <Space.Compact block>
                      <Form.Item name={[field.name, 'paraId']} noStyle required>
                        <Input type="number" style={{ width: '15%' }} placeholder="ParaId" required />
                      </Form.Item>
                      <Form.Item name={[field.name, 'sendAt']} noStyle required>
                        <Input type="number" style={{ width: '15%' }} placeholder="SendAt" required />
                      </Form.Item>
                      <Form.Item name={[field.name, 'message']} noStyle required>
                        <Input style={{ width: '70%' }} placeholder="Encoded message" required />
                      </Form.Item>
                    </Space.Compact>
                    <Button type="link" onClick={() => remove(index)}>
                      Remove
                    </Button>
                  </Form.Item>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block>
                    Add HRMP Item
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
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
        </Form.Item>
      </Form>
      <Divider />
      {storageDiff && <DiffViewer {...storageDiff} />}
    </div>
  )
}

const DryRunBlockFC = React.memo(DryRunBlock)

export default DryRunBlockFC
