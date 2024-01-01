import styled from 'styled-components'

export const HexCell = styled.div`
  max-width: 100px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const ArgsCell = styled.pre`
  overflow: scroll;
  background: #f3f3f3;
  margin: -0.5rem;
  border-radius: 0.2rem;
  padding: 0.2rem;
  font-size: small;
`

export const CompactArgsCell = styled.p`
  word-break: break-all;
  max-height: 200px;
  overflow: scroll;
`
