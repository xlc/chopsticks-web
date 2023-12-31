import React, { useEffect } from 'react'

import { Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'

import { Api } from './types'
import styled from 'styled-components'

export type PreimagesProps = {
  api: Api
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

const ArgsCell = styled.div`
  overflow-wrap: anywhere;
`

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
    title: 'Section',
    dataIndex: 'section',
  },
  {
    title: 'Method',
    dataIndex: 'method',
  },
  {
    title: 'Args',
    dataIndex: 'args',
    render: (args: string) => <ArgsCell>{args}</ArgsCell>,
  },
]

const Preimages: React.FC<PreimagesProps> = ({ api }) => {
  const [preimages, setPreimages] = React.useState<Preimage[]>()

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
          section: call?.section,
          method: call?.method,
          args: JSON.stringify((call?.args as any).map((x: any) => x.toJSON())),
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

  return <Table columns={columns} loading={preimages === undefined} dataSource={preimages} rowKey="hash" />
}

const PreimagesFC = React.memo(Preimages)

export default PreimagesFC
