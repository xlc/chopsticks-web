import { useCallback, useState } from 'react'
import { Collapse, CollapseProps } from 'antd'

import Settings from './Settings'
import Preimages from './Preimages'
import DryRun from './DryRun'
import { Api } from './types'

function App() {
  const [api, setApi] = useState<Api>()
  const [endpoint, setEndpoint] = useState<string>()

  const onConnect = useCallback((api?: Api, endpoint?: string) => {
    setApi(api)
    setEndpoint(endpoint)
  }, [setApi, setEndpoint])

  const items: CollapseProps['items'] = [
    {
      key: 'settings',
      label: 'Settings',
      children: <Settings onConnect={onConnect} />
    },
    {
      key: 'preimages',
      label: 'Preimages',
      children: api && <Preimages api={api} />
    },
    {
      key: 'dryrun',
      label: 'Dry Run',
      children: api && endpoint && <DryRun api={api} endpoint={endpoint} />
    }
  ]

  return (
    <div>
      <Collapse items={items} defaultActiveKey={['settings']} />
    </div>
  )
}

export default App
