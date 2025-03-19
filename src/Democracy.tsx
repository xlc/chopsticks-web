import { Button, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import React, { useState, useEffect } from 'react'

import { ArgsCell, CompactArgsCell, HexCell } from './components'
import { callToHuman } from './helper'
import type { Api } from './types'

export type DemocracyProps = {
  api: Api
  onDryRunPreimage: (hex: string, origin: any) => void
}

type Proposal = {
  index: number
  origin: any
  hash: string
  hex: string
  section?: string
  method?: string
  args?: any
}

const Democracy: React.FC<DemocracyProps> = ({ api, onDryRunPreimage }) => {
  const [proposal, setProposal] = useState<Proposal[]>()

  useEffect(() => {
    let canceled = false
    const fn = async () => {
      const proposal = await api.query.democracy.referendumInfoOf.entries()
      if (canceled) {
        return
      }

      const processed = await Promise.all(
        proposal.map(async ([key, data]) => {
          if ((data as any).isNone) {
            return undefined
          }

          const info = (data as any).unwrap()

          if (!info.isOngoing) {
            return undefined
          }

          const index = (key.args[0] as any).toNumber()

          const decodeCall = (hex: any) => {
            try {
              return api.registry.createType('Call', hex)
            } catch (_e) {
              return undefined
            }
          }

          const lookup = async () => {
            const proposal = info.asOngoing.proposal
            if (proposal.isInline) {
              return proposal.asInline
            }
            const data = proposal.asLookup.toJSON()
            const hash = data.hash
            const len = data.len

            const preimage = await api.query.preimage.preimageFor([hash, len])
            return preimage.toJSON() as string
          }

          const hex = await lookup()
          const call = decodeCall(hex)

          return {
            index,
            origin: {
              system: 'Root',
            },
            hex,
            method: call ? `${call.section}.${call.method}` : undefined,
            args: callToHuman(call),
          }
        }),
      )
      setProposal(processed.filter((x) => x !== undefined) as any)
    }
    fn()
    return () => {
      canceled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api])

  const columns: ColumnsType<Proposal> = [
    {
      title: '#',
      dataIndex: 'index',
    },
    {
      title: 'Hex',
      dataIndex: 'hex',
      render: (hex: string) => <HexCell>{hex}</HexCell>,
    },
    {
      title: 'Track',
      dataIndex: 'track',
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
      render: (hex: string, record) => (
        <Button disabled={!hex} onClick={() => onDryRunPreimage(hex, record.origin)}>
          Dry Run
        </Button>
      ),
    },
  ]

  return (
    <Table
      columns={columns}
      loading={proposal === undefined}
      dataSource={proposal}
      rowKey="index"
      expandable={{
        expandedRowRender: (record) => (
          <ArgsCell>
            Hex: {record.hex} <br />
            Args: {record.args}
          </ArgsCell>
        ),
      }}
    />
  )
}

const DemocracyFC = React.memo(Democracy)

export default DemocracyFC
