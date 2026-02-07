import { describe, expect, it } from 'vitest';

import { initialRunStreamState, runEventReducer } from './runEventReducer';

function reduceMany(actions: Array<{ type: 'ws.event'; event: any }>) {
  return actions.reduce((state, action) => runEventReducer(state, action), initialRunStreamState);
}

describe('runEventReducer', () => {
  it('builds one coherent run from ack + delta + final', () => {
    const state = reduceMany([
      { type: 'ws.event', event: { type: 'chat.ack', run_id: 'run-1', session_key: 'web:one' } },
      { type: 'ws.event', event: { type: 'chat.delta', run_id: 'run-1', text_delta: 'Hello ' } },
      { type: 'ws.event', event: { type: 'chat.delta', run_id: 'run-1', text_delta: 'world' } },
      { type: 'ws.event', event: { type: 'chat.final', run_id: 'run-1', full_text: 'Hello world' } },
    ]);

    const run = state.runs['run-1'];
    expect(run).toBeDefined();
    expect(run.content).toBe('Hello world');
    expect(run.status).toBe('final');
    expect(state.activeRunBySession['web:one']).toBeNull();
  });

  it('keeps interleaved runs isolated by run id', () => {
    const state = reduceMany([
      { type: 'ws.event', event: { type: 'chat.ack', run_id: 'run-a', session_key: 'web:a' } },
      { type: 'ws.event', event: { type: 'chat.ack', run_id: 'run-b', session_key: 'web:b' } },
      { type: 'ws.event', event: { type: 'chat.delta', run_id: 'run-a', text_delta: 'A1' } },
      { type: 'ws.event', event: { type: 'chat.delta', run_id: 'run-b', text_delta: 'B1' } },
      { type: 'ws.event', event: { type: 'chat.delta', run_id: 'run-a', text_delta: 'A2' } },
    ]);

    expect(state.runs['run-a'].content).toBe('A1A2');
    expect(state.runs['run-b'].content).toBe('B1');
  });

  it('maps tool.start and tool.end into ordered tool steps', () => {
    const state = reduceMany([
      { type: 'ws.event', event: { type: 'chat.ack', run_id: 'run-tools', session_key: 'web:tools' } },
      { type: 'ws.event', event: { type: 'tool.start', run_id: 'run-tools', tool_name: 'shell', args: { cmd: 'pwd' } } },
      { type: 'ws.event', event: { type: 'tool.end', run_id: 'run-tools', tool_name: 'shell', result_preview: '/tmp', ok: true } },
    ]);

    expect(state.runs['run-tools'].tools).toHaveLength(1);
    expect(state.runs['run-tools'].tools[0].status).toBe('done');
    expect(state.runs['run-tools'].tools[0].name).toBe('shell');
    expect(state.runs['run-tools'].tools[0].resultPreview).toBe('/tmp');
  });
});
