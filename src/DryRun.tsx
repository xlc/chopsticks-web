import React, { useCallback, useState } from 'react'

import { Api } from './types'
import { Button, Form, Input, Typography } from 'antd'
import { setStorage, setup } from '@acala-network/chopsticks-core'
import { IdbDatabase } from '@acala-network/chopsticks-db/browser'

import '@acala-network/chopsticks-core/wasm-executor/browser-wasm-executor'

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

  const onFinish = useCallback(async (values: any) => {
    const { preimage, origin } = values
    const originJson = parseJson(origin)

    if (!preimage || !originJson) {
      return
    }

    setIsLoading(true)
    setMessage('Starting')

    const blockNumber = (await api.query.system.number() as any).toNumber()
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
            [blockNumber + 1], [
              {
                call: {
                  inline: preimage,
                },
                origin: originJson,
              }
            ]
          ]
        ]
      }
    })

    await chain.newBlock()

    setMessage('Dry run completed')

    console.log(chain.head)

  }, [api, endpoint, setIsLoading, setMessage])

  return (
    <Form onFinish={onFinish} disabled={isLoading}>
      <Form.Item label="preimage" name="preimage" rules={[{ required: true, pattern: /^0x[\da-f]+$/i, message: 'Not a hex value with 0x prefix' }]}>
        <Input pattern="0x[0-9a-fA-F]+" />
      </Form.Item>
      <Form.Item label="origin" name="origin" required initialValue={JSON.stringify(rootOrigin)}>
        <Input/>
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit">
          Run
        </Button>
      </Form.Item>
      <Form.Item>
        <Typography.Text>{message}</Typography.Text>
      </Form.Item>
    </Form>
  )
}

const DryRunFC = React.memo(DryRun)

export default DryRunFC
