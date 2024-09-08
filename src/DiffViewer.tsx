import React, { useCallback, useMemo, useState } from 'react'
import { JSONTree } from 'react-json-tree'
import _ from 'lodash'
import styled from 'styled-components'

export type DiffViewerProps = {
  oldState: any
  delta: any
  newState: any
}

const expandFirstLevel = (_keyName: any, _data: any, level: number) => level <= 1

function stringifyAndShrink(val: any) {
  if (val == null) return 'null'
  if (typeof val === 'string') return val
  return JSON.stringify(val, null, 1)
}

function prepareDelta(value: any) {
  if (value && value._t === 'a') {
    const res = {} as any
    for (const key in value) {
      if (key !== '_t') {
        if (key[0] === '_' && !value[key.substring(1)]) {
          res[key.substring(1)] = value[key]
        } else if (value['_' + key]) {
          res[key] = [value['_' + key][0], value[key][0]]
        } else if (!value['_' + key] && key[0] !== '_') {
          res[key] = value[key]
        }
      }
    }
    return res
  }
  return value
}

const theme = {
  scheme: 'monokai',
  base00: '#272822',
  base01: '#383830',
  base02: '#49483e',
  base03: '#75715e',
  base04: '#a59f85',
  base05: '#f8f8f2',
  base06: '#f5f4f1',
  base07: '#f9f8f5',
  base08: '#f92672',
  base09: '#fd971f',
  base0A: '#f4bf75',
  base0B: '#a6e22e',
  base0C: '#a1efe4',
  base0D: '#66d9ef',
  base0E: '#ae81ff',
  base0F: '#cc6633',
}

const DiffSpan = styled.span`
  padding: 2px 4px;
  border-radius: 4px;
  position: relative;
  line-height: 150%;

  & > button {
    border: none;
    border-radius: 6px;
    padding: 6px;
    cursor: pointer;
    cursor: pointer;
    opacity: 60%;
    width: 26px;
    height: 26px;
    margin-left: 10px;
  }

  & > button > img {
    width: 100%;
    height: 100%;
  }

  & > button:hover {
    opacity: 100%;
  }

  li:has(> span > span.diffWrap > span.diffRemove) > label {
    color: red !important;
    text-decoration: line-through;
    text-decoration-thickness: 1px;
  }

  &.diffAdd {
    color: #428442;
    display: inline-flex;
  }

  &.diffRemove {
    text-decoration: line-through;
    text-decoration-thickness: 1px;
    color: red;
    display: inline-flex;
  }

  &.diffUpdateFrom {
    text-decoration: line-through;
    text-decoration-thickness: 1px;
    color: red;
    display: inline-flex;
  }

  &.diffUpdateTo {
    color: #428442;
    display: inline-flex;
  }

  &.diffUpdateArrow {
    color: #ccc;
  }

  &.unchanged {
    color: #666;
  }

  &.delta {
    color: #ccc;
    font-size: 12px;
    margin: 0 10px;
  }
`

const DiffWrapSpan = styled.span`
  position: relative;
  z-index: 1;
`

const PartialViewer = styled.div`
  min-width: 300px;
`

const MainViewer = styled.div`
  width: 80%;
`

const enum ViewMode {
  Events = 'events',
  Changed = 'changed',
  Unchanged = 'unchanged',
}

const DiffViewer: React.FC<DiffViewerProps> = ({ oldState, delta, newState }) => {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Events)
  const [partial, setPartial] = useState(null)

  const handleViewModeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setViewMode(e.target.value as ViewMode)
    },
    [setViewMode],
  )

  const data = useMemo(() => {
    switch (viewMode) {
      case ViewMode.Unchanged:
        return _.merge(_.cloneDeep(oldState), delta)
      case ViewMode.Changed:
        return delta
      case ViewMode.Events: {
        const events = _.get(newState, 'system.events').map((e: any) => ({
          phase: typeof e.phase === 'string' ? e.phase : JSON.stringify(e.phase),
          kind: `${e.event.section}.${e.event.method}`,
          data: e.event.data,
        }))
        const upwardMessages = _.get(newState, 'parachainSystem.upwardMessages')
        const downwardMessages = _.get(newState, 'dmp.downwardMessageQueues')
        const horizontalMessages = _.get(newState, 'parachainSystem.hrmpOutboundMessages')
        return {
          ...(upwardMessages && upwardMessages.length > 0 ? { UpwardMessages: upwardMessages } : {}),
          ...(downwardMessages && downwardMessages.length > 0 ? { DownwardMessages: downwardMessages } : {}),
          ...(horizontalMessages && horizontalMessages.length > 0 ? { HorizontalMessages: horizontalMessages } : {}),
          SystemEvents: events,
        }
      }
      default:
        throw new Error(`Unsupported view mode: ${viewMode}`)
    }
  }, [oldState, delta, newState, viewMode])

  const viewPartial = useCallback(
    (value: any) => {
      setPartial((partial) => (_.isEqual(partial, value) ? null : value))
    },
    [setPartial],
  )

  function valueRenderer(viewPartial: any) {
    return function (_raw: any, value: any, ...keys: any[]) {
      const modifyPath = keys.reverse().join('.')
      const removePath = keys.map((x) => (Number.isInteger(parseInt(x)) ? '_' + x : x)).join('.')
      const isDelta = _.has(delta, modifyPath) || _.has(delta, removePath)

      function renderSpan(name: string, body: any, raw?: any) {
        return (
          <DiffSpan key={name} className={name}>
            {body}
            {_.isObjectLike(raw) ? (
              <button onClick={() => viewPartial({ [modifyPath]: raw })}>
                <img src="data:image/svg+xml;base64,PCFET0NUWVBFIHN2ZyBQVUJMSUMgIi0vL1czQy8vRFREIFNWRyAxLjEvL0VOIiAiaHR0cDovL3d3dy53My5vcmcvR3JhcGhpY3MvU1ZHLzEuMS9EVEQvc3ZnMTEuZHRkIj4KDTwhLS0gVXBsb2FkZWQgdG86IFNWRyBSZXBvLCB3d3cuc3ZncmVwby5jb20sIFRyYW5zZm9ybWVkIGJ5OiBTVkcgUmVwbyBNaXhlciBUb29scyAtLT4KPHN2ZyBmaWxsPSIjMDAwMDAwIiBoZWlnaHQ9IjY0cHgiIHdpZHRoPSI2NHB4IiB2ZXJzaW9uPSIxLjEiIGlkPSJMYXllcl8xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2aWV3Qm94PSIwIDAgMjQyLjEzMyAyNDIuMTMzIiB4bWw6c3BhY2U9InByZXNlcnZlIiBzdHJva2U9IiMwMDAwMDAiPgoNPGcgaWQ9IlNWR1JlcG9fYmdDYXJyaWVyIiBzdHJva2Utd2lkdGg9IjAiLz4KDTxnIGlkPSJTVkdSZXBvX3RyYWNlckNhcnJpZXIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgoNPGcgaWQ9IlNWR1JlcG9faWNvbkNhcnJpZXIiPiA8ZyBpZD0iWE1MSURfMjVfIj4gPHBhdGggaWQ9IlhNTElEXzI2XyIgZD0iTTg5LjI0NywxMzEuNjczbC00Ny43MzIsNDcuNzNsLTE1LjkwOS0xNS45MWMtNC4yOS00LjI5MS0xMC43NDItNS41NzItMTYuMzQ3LTMuMjUyIEMzLjY1NCwxNjIuNTYzLDAsMTY4LjAzMywwLDE3NC4xdjUzLjAzMmMwLDguMjg0LDYuNzE2LDE1LDE1LDE1bDUzLjAzMywwLjAwMWMwLjAwNy0wLjAwMSwwLjAxMi0wLjAwMSwwLjAxOSwwIGM4LjI4NSwwLDE1LTYuNzE2LDE1LTE1YzAtNC4zNzctMS44NzUtOC4zMTYtNC44NjUtMTEuMDU5bC0xNS40NTgtMTUuNDU4bDQ3LjczLTQ3LjcyOWM1Ljg1OC01Ljg1OCw1Ljg1OC0xNS4zNTUsMC0yMS4yMTMgQzEwNC42MDMsMTI1LjgxNSw5NS4xMDQsMTI1LjgxNiw4OS4yNDcsMTMxLjY3M3oiLz4gPHBhdGggaWQ9IlhNTElEXzI4XyIgZD0iTTIyNy4xMzMsMEgxNzQuMWMtNi4wNjcsMC0xMS41MzYsMy42NTUtMTMuODU4LDkuMjZjLTIuMzIxLDUuNjA1LTEuMDM4LDEyLjA1NywzLjI1MiwxNi4zNDdsMTUuOTExLDE1LjkxMSBsLTQ3LjcyOSw0Ny43M2MtNS44NTgsNS44NTgtNS44NTgsMTUuMzU1LDAsMjEuMjEzYzIuOTI5LDIuOTI5LDYuNzY4LDQuMzkzLDEwLjYwNiw0LjM5M2MzLjgzOSwwLDcuNjc4LTEuNDY0LDEwLjYwNi00LjM5NCBsNDcuNzMtNDcuNzNsMTUuOTA5LDE1LjkxYzIuODY5LDIuODcsNi43MDYsNC4zOTQsMTAuNjA5LDQuMzk0YzEuOTMzLDAsMy44ODItMC4zNzMsNS43MzctMS4xNDIgYzUuNjA1LTIuMzIyLDkuMjYtNy43OTIsOS4yNi0xMy44NThWMTVDMjQyLjEzMyw2LjcxNiwyMzUuNDE3LDAsMjI3LjEzMywweiIvPiA8L2c+IDwvZz4KDTwvc3ZnPg==" />
              </button>
            ) : null}
          </DiffSpan>
        )
      }

      function renderDelta(value: any) {
        if (/^\d+(,\d+)*$/.test(value[0]) && /^\d+(,\d+)*$/.test(value[1])) {
          const oldValue = BigInt(value[0].replace(/,/g, ''))
          const newValue = BigInt(value[1].replace(/,/g, ''))
          if (oldValue > 0 && newValue > 0) {
            const delta = newValue - oldValue
            return (
              <span className="delta">
                {delta > 0 ? '+' : ''}
                {delta.toLocaleString()}
              </span>
            )
          }
        }
      }

      if (isDelta && Array.isArray(value)) {
        switch (value.length) {
          case 0:
            return <DiffWrapSpan>{renderSpan('diff', '[]')}</DiffWrapSpan>
          case 1:
            return <DiffWrapSpan>{renderSpan('diffAdd', stringifyAndShrink(value[0]), value[0])}</DiffWrapSpan>
          case 2:
            return (
              <DiffWrapSpan>
                {renderSpan('diffUpdateFrom', stringifyAndShrink(value[0]), value[0])}
                {renderSpan('diffUpdateArrow', ' => ')}
                {renderSpan('diffUpdateTo', stringifyAndShrink(value[1]), value[1])}
                {renderDelta(value)}
              </DiffWrapSpan>
            )
          case 3:
            return <DiffWrapSpan>{renderSpan('diffRemove', stringifyAndShrink(value[0]), value[0])}</DiffWrapSpan>
        }
      }

      return <DiffWrapSpan>{renderSpan('unchanged', stringifyAndShrink(value), value)}</DiffWrapSpan>
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'row' }}>
        <MainViewer>
          <input
            type="radio"
            id="show_events"
            name="viewMode"
            value="events"
            checked={viewMode === 'events'}
            onChange={handleViewModeChange}
          />
          <label htmlFor="show_events">Events</label>
          <input
            type="radio"
            id="show_changed"
            name="viewMode"
            value="changed"
            checked={viewMode === 'changed'}
            onChange={handleViewModeChange}
          />
          <label htmlFor="show_changed">Changed</label>
          <input
            type="radio"
            id="show_unchanged"
            name="viewMode"
            value="unchanged"
            checked={viewMode === 'unchanged'}
            onChange={handleViewModeChange}
          />
          <label htmlFor="show_unchanged">Unchanged</label>
          {viewMode === ViewMode.Events ? (
            <JSONTree theme={theme} invertTheme={true} data={data} shouldExpandNodeInitially={(_k, _d, l) => l <= 3} hideRoot />
          ) : (
            <JSONTree
              theme={theme}
              invertTheme={true}
              data={data}
              valueRenderer={valueRenderer(viewPartial)}
              postprocessValue={prepareDelta}
              isCustomNode={Array.isArray}
              shouldExpandNodeInitially={expandFirstLevel}
              hideRoot
            />
          )}
        </MainViewer>
        {partial ? (
          <PartialViewer>
            <JSONTree theme={theme} invertTheme={true} data={partial} shouldExpandNodeInitially={() => true} hideRoot />
          </PartialViewer>
        ) : null}
      </div>
    </div>
  )
}

const DiffViewerFC = React.memo(DiffViewer)

export default DiffViewerFC
