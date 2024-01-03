import { useCallback, useState } from 'react'
import { Collapse, CollapseProps, Spin } from 'antd'

import type { Api } from './types'

import Settings from './Settings'
import Preimages from './Preimages'
import DryRun from './DryRun'
import Referenda from './Referenda'
import Collectives from './Collectives'

function App() {
  const [api, setApi] = useState<Api>()
  const [endpoint, setEndpoint] = useState<string>()
  const [activeKey, setActiveKey] = useState<string[]>(['settings'])
  const [preimage, setPreimage] = useState<{ hex: string; origin: any }>()

  const onConnect = useCallback(
    (api?: Api, endpoint?: string) => {
      setApi(api)
      setEndpoint(endpoint)
    },
    [setApi, setEndpoint],
  )

  const onDryRunPreimage = useCallback(
    (hex: string, origin?: any) => {
      const newKeys = [...activeKey].filter((key) => key === 'settings' || key === 'dryrun')
      if (newKeys.indexOf('dryrun') < 0) {
        newKeys.push('dryrun')
      }
      setActiveKey(newKeys)
      setPreimage({ hex, origin })
    },
    [activeKey, setActiveKey],
  )

  const onChangeActiveKey = useCallback(
    (activeKey: string | string[]) => {
      setActiveKey(Array.isArray(activeKey) ? activeKey : [activeKey])
    },
    [setActiveKey],
  )

  const items: CollapseProps['items'] = [
    {
      key: 'settings',
      label: 'Settings',
      children: <Settings onConnect={onConnect} />,
    },
    {
      key: 'preimages',
      label: 'Preimages',
      children: api ? <Preimages api={api} onDryRunPreimage={onDryRunPreimage} /> : <Spin spinning={true} />,
    },
    ...(api?.query.referenda
      ? [
          {
            key: 'referenda',
            label: 'Referenda',
            children: api ? (
              <Referenda api={api} onDryRunPreimage={onDryRunPreimage} referendaPallet="referenda" />
            ) : (
              <Spin spinning={true} />
            ),
          },
        ]
      : []),
    ...(api?.query.fellowshipReferenda
      ? [
          {
            key: 'fellowship-referenda',
            label: 'Fellowship Referenda',
            children:
              api && api.query.fellowshipReferenda ? (
                <Referenda api={api} onDryRunPreimage={onDryRunPreimage} referendaPallet="fellowshipReferenda" />
              ) : (
                <Spin spinning={true} />
              ),
          },
        ]
      : []),
    ...(api?.query.generalCouncil
      ? [
          {
            key: 'general-council',
            label: 'Council',
            children: api ? (
              <Collectives api={api} onDryRunPreimage={onDryRunPreimage} collectivesPallet="generalCouncil" />
            ) : (
              <Spin spinning={true} />
            ),
          },
        ]
      : []),
    ...(api?.query.council
      ? [
          {
            key: 'council',
            label: 'Council',
            children: api ? (
              <Collectives api={api} onDryRunPreimage={onDryRunPreimage} collectivesPallet="council" />
            ) : (
              <Spin spinning={true} />
            ),
          },
        ]
      : []),
    ...(api?.query.technicalCommittee
      ? [
          {
            key: 'technical-committee',
            label: 'TechnicalCommittee',
            children: api ? (
              <Collectives api={api} onDryRunPreimage={onDryRunPreimage} collectivesPallet="technicalCommittee" />
            ) : (
              <Spin spinning={true} />
            ),
          },
        ]
      : []),
    {
      key: 'dryrun',
      label: 'Dry Run',
      children:
        api && endpoint ? <DryRun api={api} endpoint={endpoint} preimage={preimage} /> : <Spin spinning={true} />,
    },
  ]

  return (
    <div>
      <Collapse items={items} activeKey={activeKey} onChange={onChangeActiveKey} />
    </div>
  )
}

export default App
