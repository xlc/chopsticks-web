import React, { useState, useEffect } from 'react'

import { Button, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import styled from 'styled-components'

import { Api } from './types'

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

const HexCell = styled.div`
  max-width: 100px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const ArgsCell = styled.pre`
  overflow: scroll;
  background: #f3f3f3;
  margin: -0.5rem;
  border-radius: 0.2rem;
  padding: 0.2rem;
  font-size: small;
`

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
          args: JSON.stringify(
            Object.fromEntries((call?.argsEntries as any).map(([k, v]: any) => [k, v.toHuman()])),
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
      title: 'Method',
      dataIndex: 'method',
    },
    {
      title: 'Args',
      dataIndex: 'args',
      render: (args: string) => <p>{args}</p>,
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
