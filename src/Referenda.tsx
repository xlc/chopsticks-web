import { Button, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import _ from 'lodash'
import React, { useState, useEffect } from 'react'

import { ArgsCell, CompactArgsCell, HexCell } from './components'
import { callToHuman } from './helper'
import type { Api } from './types'

export type ReferendaProps = {
  api: Api
  onDryRunPreimage: (hex: string, origin: any) => void
  referendaPallet: string
}

type Referendum = {
  index: number
  track: string
  origin: any
  hex: string
  section?: string
  method?: string
  args?: any
}

const Referenda: React.FC<ReferendaProps> = ({ api, onDryRunPreimage, referendaPallet }) => {
  const [referendum, setReferendum] = useState<Referendum[]>()
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    setEnabled(!!api.query[referendaPallet])
  }, [api, referendaPallet])

  useEffect(() => {
    if (!enabled) {
      return
    }
    let canceled = false
    const fn = async () => {
      const referendum = await api.query[referendaPallet].referendumInfoFor.entries()
      if (canceled) {
        return
      }

      const tracks = api.consts[referendaPallet].tracks as any

      const processed = await Promise.all(
        referendum.map(async ([key, data]) => {
          if ((data as any).isNone) {
            return undefined
          }

          const info = (data as any).unwrap()

          if (!info.isOngoing) {
            return undefined
          }

          const ongoing = info.asOngoing

          const decodeCall = (hex: any) => {
            try {
              return api.registry.createType('Call', hex)
            } catch (_e) {
              return undefined
            }
          }

          const lookup = async () => {
            const proposal = ongoing.proposal
            if (proposal.isInline) {
              return proposal.asInline
            }
            if (proposal.isLegacy) {
              return undefined // not supported
            }
            const data = proposal.asLookup.toJSON()
            const hash = data.hash
            const len = data.len

            const preimage = await api.query.preimage.preimageFor([hash, len])
            return preimage.toJSON() as string
          }

          const hex = await lookup()
          if (!hex) {
            return undefined
          }
          const call = decodeCall(hex)

          const index = (key.args[0] as any).toNumber()

          const trackNumber = ongoing.track.toNumber() as number

          const track = tracks.find(([key]: any) => key.eq(trackNumber))[1]

          return {
            index,
            track: _.startCase(track.name.toString()),
            origin: ongoing.origin,
            hex,
            method: call ? `${call.section}.${call.method}` : undefined,
            args: callToHuman(call),
          }
        }),
      )
      setReferendum(processed.filter((x) => x !== undefined) as any)
    }
    fn()
    return () => {
      canceled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, api, referendaPallet])

  const columns: ColumnsType<Referendum> = [
    {
      title: '#',
      dataIndex: 'index',
      sorter: (a, b) => a.index - b.index,
    },
    {
      title: 'Hex',
      dataIndex: 'hex',
      render: (hex: string) => <HexCell>{hex}</HexCell>,
    },
    {
      title: 'Track',
      dataIndex: 'track',
      sorter: (a, b) => (a.track || '').localeCompare(b.track || ''),
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
      loading={referendum === undefined && enabled}
      dataSource={referendum}
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

const ReferendaFC = React.memo(Referenda)

export default ReferendaFC
