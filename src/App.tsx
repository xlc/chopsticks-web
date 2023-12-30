import { useState } from 'react'
import { ApiDecoration } from '@polkadot/api/types'

import Settings from './Settings'

function App() {
  const [api, setApi] = useState<ApiDecoration<'promise'>>()

  void api
  return (
    <div>
      <Settings onConnect={setApi} />
    </div>
  )
}

export default App
