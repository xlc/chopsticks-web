import { useState } from 'react'
import { ApiDecoration } from '@polkadot/api/types'
import { Collapse, CollapseProps } from 'antd'

import Settings from './Settings'
import Preimages from './Preimages'

function App() {
  const [api, setApi] = useState<ApiDecoration<'promise'>>()

  const items: CollapseProps['items'] = [
    {
      key: 'settings',
      label: 'Settings',
      children: <Settings onConnect={setApi} />
    },
    {
      key: 'preimages',
      label: 'Preimages',
      children: api && <Preimages api={api} />
    }
  ]

  return (
    <div>
      <Collapse items={items} defaultActiveKey={['settings']} />
    </div>
  )
}

export default App
