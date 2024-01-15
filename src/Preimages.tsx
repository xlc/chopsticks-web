import React, { useState, useEffect } from 'react'

import { Button, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'

import { Api } from './types'
import { ArgsCell, CompactArgsCell, HexCell } from './components'

export type PreimagesProps = {
  api: Api
  onDryRunPreimage: (hex: string) => void
}

type Preimage = {
  hex: string
  hash: string
  section?: string
  method?: string
  args?: any
}

const Preimages: React.FC<PreimagesProps> = ({ api, onDryRunPreimage }) => {
  const [preimages, setPreimages] = useState<Preimage[]>()

  useEffect(() => {
    let canceled = false
    const fn = async () => {
      const preimages = await api.query.preimage.preimageFor.entries()
      if (canceled) {
        return
      }
      const processed = preimages.map(([key, data]) => {
        const hex = data.toJSON() as string

        const decodeCall = () => {
          try {
            return api.registry.createType('Call', hex)
          } catch (_e) {
            return undefined
          }
        }

        const call = decodeCall()

        return {
          hex,
          hash: (key.args[0] as any)[0].toHex(),
          method: call ? `${call.section}.${call.method}` : undefined,
          args:
            call &&
            JSON.stringify(
              Object.fromEntries((call.argsEntries as any).map(([k, v]: any) => [k, v.toHuman()])),
              null,
              2,
            ),
        }
      })
      setPreimages(processed)
    }
    fn()
    return () => {
      canceled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const columns: ColumnsType<Preimage> = [
    {
      title: 'Hash',
      dataIndex: 'hash',
      render: (hash: string) => <HexCell>{hash}</HexCell>,
    },
    {
      title: 'Hex',
      dataIndex: 'hex',
      render: (hex: string) => <HexCell>{hex}</HexCell>,
    },
    {
      title: 'Len',
      render: (record) => <span>{record.hex.length / 2 - 1}</span>,
    },
    {
      title: 'Method',
      dataIndex: 'method',
    },
    {
      title: 'Args',
      dataIndex: 'args',
      render: (args: string) => <CompactArgsCell>{args}</CompactArgsCell>,
    },
    {
      dataIndex: 'hex',
      render: (hex: string) => <Button onClick={() => onDryRunPreimage(hex)}>Dry Run</Button>,
    },
  ]

  return (
    <Table
      columns={columns}
      loading={preimages === undefined}
      dataSource={preimages}
      rowKey="hash"
      expandable={{
        expandedRowRender: (record) => (
          <ArgsCell>
            Hash: {record.hash} <br />
            Hex: {record.hex} <br />
            Args: {record.args}
          </ArgsCell>
        ),
      }}
    />
  )
}

const PreimagesFC = React.memo(Preimages)

export default PreimagesFC
