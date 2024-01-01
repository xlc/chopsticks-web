import React, { useState, useEffect } from 'react'
import _ from 'lodash'
import { Button, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import styled from 'styled-components'

import { Api } from './types'

export type ReferendaProps = {
  api: Api
  onDryRunPreimage: (hex: string, origin: any) => void
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

const Referenda: React.FC<ReferendaProps> = ({ api, onDryRunPreimage }) => {
  const [referendum, setReferendum] = useState<Referendum[]>()
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    setEnabled(!!api.query.referenda)
  }, [api])

  useEffect(() => {
    if (!enabled) {
      return
    }
    let canceled = false
    const fn = async () => {
      const referendum = await api.query.referenda.referendumInfoFor.entries()
      if (canceled) {
        return
      }

      const tracks = api.consts.referenda.tracks as any

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
            const data = proposal.asLookup.toJSON()
            const hash = data.hash
            const len = data.len

            const preimage = await api.query.preimage.preimageFor([hash, len])
            return preimage.toJSON() as string
          }

          const hex = await lookup()
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
      setReferendum(processed.filter((x) => x !== undefined) as any)
    }
    fn()
    return () => {
      canceled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  const columns: ColumnsType<Referendum> = [
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
      render: (args: string) => <p>{args}</p>,
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
