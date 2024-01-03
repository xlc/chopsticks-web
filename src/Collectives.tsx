import React, { useState, useEffect } from 'react'
import { Button, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'

import { Api } from './types'
import { ArgsCell, CompactArgsCell, HexCell } from './components'

export type CollectivesProps = {
  api: Api
  onDryRunPreimage: (hex: string, origin: any) => void
  collectivesPallet: string
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

const Collectives: React.FC<CollectivesProps> = ({ api, onDryRunPreimage, collectivesPallet }) => {
  const [proposal, setProposal] = useState<Proposal[]>()
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    setEnabled(!!api.query[collectivesPallet])
  }, [api, collectivesPallet])

  useEffect(() => {
    if (!enabled) {
      return
    }
    let canceled = false
    const fn = async () => {
      const proposal = await api.query[collectivesPallet].proposalOf.entries()
      if (canceled) {
        return
      }

      const processed = await Promise.all(
        proposal.map(async ([key, data]) => {
          if ((data as any).isNone) {
            return undefined
          }

          const hash = key.args[0].toHex()

          const call = (data as any).unwrap()

          const members: any = await api.query[collectivesPallet].members()
          const membersCount = members.length

          const vote = ((await api.query[collectivesPallet].voting(hash)) as any).unwrap()

          return {
            index: vote.index.toNumber(),
            origin: {
              [collectivesPallet]: {
                Members: [vote.threshold.toNumber(), membersCount],
              },
            },
            hash,
            hex: call.toHex(),
            method: call ? `${call.section}.${call.method}` : undefined,
            args:
              call &&
              JSON.stringify(
                Object.fromEntries((call.argsEntries as any).map(([k, v]: any) => [k, v.toHuman()])),
                null,
                2,
              ),
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
  }, [enabled])

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
      loading={proposal === undefined && enabled}
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

const CollectivesFC = React.memo(Collectives)

export default CollectivesFC
