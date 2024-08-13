import React, { useCallback, useEffect, useMemo, useState } from 'react'
import useLocalStorage from '@rehooks/local-storage'
import { AutoComplete, Button, Form, Typography } from 'antd'
import { ApiPromise, WsProvider } from '@polkadot/api'
import _ from 'lodash'
import { useSearchParams } from 'react-router-dom'

import { Api } from './types'

const endpoints = [
  'wss://rpc.polkadot.io',
  'wss://polkadot-collectives-rpc.polkadot.io',
  'wss://kusama-rpc.polkadot.io',
  'wss://acala-rpc.aca-api.network',
  'wss://karura-rpc.aca-api.network',
]

const blockHeightOptions = [
  {
    value: 'latest',
  },
  {
    value: 'last',
  },
]

export type SettingsProps = {
  onConnect: (api?: Api, endpoint?: string) => void
}

const Settings: React.FC<SettingsProps> = ({ onConnect }) => {
  const [endpoint, setEndpoint] = useLocalStorage('endpoint')
  const [blockHeight, setBlockHeight] = useLocalStorage('blockHeight')
  const [searchParams, setSearchParams] = useSearchParams()
  const [api, setApi] = useState<ApiPromise>()
  const [apiAt, setApiAt] = useState<Api>()
  const [connectionStatus, setConnectionStatus] = useState<string>()

  const endpointOptions = useMemo(() => {
    const endpointOptions = new Set(endpoints)
    if (endpoint != undefined) {
      endpointOptions.add(endpoint)
    }
    return Array.from(endpointOptions).map((endpoint) => ({ value: endpoint }))
  }, [endpoint])

  const blockHeightValidator = useCallback(async (_rule: any, value: string) => {
    if (value === 'latest' || value === 'last') {
      return
    } else {
      const blockHeight = parseInt(value)
      if (isNaN(blockHeight)) {
        return 'Not a valid block height'
      } else if (blockHeight < 0) {
        return 'Block height must be greater than or equal to 0'
      } else {
        return
      }
    }
  }, [])

  const onFinish = useCallback(
    async (values: any) => {
      const { endpoint: newEndpoint, blockHeight: newBlockHeight } = values
      const updateApi = api === undefined || endpoint !== newEndpoint
      const updateApiAt = apiAt === undefined || updateApi || blockHeight !== newBlockHeight

      if (!updateApi && !updateApiAt) {
        return
      }

      setEndpoint(newEndpoint)
      setBlockHeight(newBlockHeight)

      if (updateApi && api !== undefined) {
        api.disconnect()
        setApi(undefined)
      }
      if (updateApiAt && apiAt !== undefined) {
        setApiAt(undefined)
      }
      setConnectionStatus('Connecting...')

      // TODO: figure why this is called multiple times and ensure we don't create extra connections
      const wsProvider = new WsProvider(newEndpoint)
      const newApi = await ApiPromise.create({ provider: wsProvider })
      setApi(newApi)

      if (newBlockHeight === 'latest') {
        setApiAt(newApi)
      } else {
        if (newBlockHeight === 'last') {
          const blockHash = await newApi.rpc.chain.getBlockHash()
          const newApiAt = await newApi.at(blockHash)
          setApiAt(newApiAt)
          setBlockHeight((await newApiAt.query.system.number()).toString())
        } else {
          try {
            const blockHash = await newApi.rpc.chain.getBlockHash(newBlockHeight)
            setApiAt(await newApi.at(blockHash))
          } catch (_e) {
            setBlockHeight('last')
            setConnectionStatus('Block height not found')
          }
        }
      }
    },
    [endpoint, blockHeight, api, apiAt, setEndpoint, setBlockHeight],
  )

  useEffect(() => {
    const name = _.capitalize(apiAt?.runtimeVersion.specName.toString())
    const unsub: any = apiAt?.query.system.number((val: any) => setConnectionStatus(`Connected: ${name} @ ${val}`))
    return () => {
      const f = async () => {
        const u = await unsub
        u?.()
      }
      f()
    }
  }, [apiAt])

  useEffect(() => {
    if (apiAt) {
      onConnect(apiAt, endpoint || undefined)
    } else {
      onConnect(undefined, undefined)
    }
  }, [apiAt, endpoint, onConnect])

  useEffect(() => {
    let initialEndpoint = endpoint ?? endpoints[0]
    let initialBlockHeight = blockHeight ?? 'latest'
    if (searchParams.has('endpoint')) {
      initialEndpoint = searchParams.get('endpoint')!
      setEndpoint(initialEndpoint)
    } else {
      searchParams.set('endpoint', initialEndpoint)
      setSearchParams(searchParams)
    }
    if (searchParams.has('blockHeight')) {
      initialBlockHeight = searchParams.get('blockHeight')!
      setBlockHeight(initialBlockHeight)
    } else {
      searchParams.set('blockHeight', initialBlockHeight)
      setSearchParams(searchParams)
    }
    onFinish({
      endpoint: initialEndpoint,
      blockHeight: initialBlockHeight,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    searchParams.set('endpoint', endpoint!)
    setSearchParams(searchParams)

    searchParams.set('blockHeight', blockHeight!)
    setSearchParams(searchParams)
  }, [endpoint, blockHeight, searchParams, setSearchParams])

  return (
    <Form layout="inline" onFinish={onFinish}>
      <Form.Item
        label="endpoint"
        name="endpoint"
        required
        initialValue={endpoint ?? endpoints[0]}
        rules={[{ pattern: /^wss?:\/\//, message: 'Not a valid WebSocket endpoint' }]}
      >
        <AutoComplete style={{ minWidth: 300 }} options={endpointOptions} />
      </Form.Item>
      <Form.Item
        label="block height"
        name="blockHeight"
        required
        initialValue={blockHeight ?? 'latest'}
        rules={[{ validator: blockHeightValidator }]}
      >
        <AutoComplete style={{ minWidth: 100 }} options={blockHeightOptions} />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit">
          Connect
        </Button>
      </Form.Item>
      <Form.Item>
        <Typography.Text>{connectionStatus}</Typography.Text>
      </Form.Item>
    </Form>
  )
}

const SettingsFC = React.memo(Settings)
export default SettingsFC
