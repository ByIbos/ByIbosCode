/**
 * ByIbosCode Local Proxy v2.0
 * Translates Anthropic API format to OpenAI format -> Forwards to LM Studio
 * Fake Stream + Tool Call Support included
 */

const http = require('http');

const LM_STUDIO_BASE = 'http://localhost:1234';
const PROXY_PORT = 8082;

function convertMessages(anthropicMessages) {
  const result = [];

  for (const msg of anthropicMessages) {
    if (typeof msg.content === 'string') {
      result.push({ role: msg.role, content: msg.content });
      continue;
    }

    if (Array.isArray(msg.content)) {
      if (msg.content.some(b => b.type === 'tool_result')) {
        for (const block of msg.content) {
          if (block.type === 'tool_result') {
            const content = Array.isArray(block.content)
              ? block.content.map(c => c.text || '').join('\n')
              : String(block.content || '');
            result.push({
              role: 'tool',
              tool_call_id: block.tool_use_id || 'unknown',
              content,
            });
          }
        }
        continue;
      }

      if (msg.role === 'assistant') {
        const textBlocks = msg.content.filter(b => b.type === 'text');
        const toolBlocks = msg.content.filter(b => b.type === 'tool_use');

        const assistantMsg = {
          role: 'assistant',
          content: textBlocks.map(b => b.text).join('\n') || null,
        };

        if (toolBlocks.length > 0) {
          assistantMsg.tool_calls = toolBlocks.map(b => ({
            id: b.id || `call_${Date.now()}`,
            type: 'function',
            function: {
              name: b.name,
              arguments: JSON.stringify(b.input || {}),
            },
          }));
        }

        result.push(assistantMsg);
        continue;
      }

      const text = msg.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n');
      result.push({ role: 'user', content: text || ' ' });
    }
  }

  return result;
}

function convertTools(anthropicTools) {
  if (!anthropicTools || anthropicTools.length === 0) return undefined;
  return anthropicTools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description || '',
      parameters: tool.input_schema || { type: 'object', properties: {} },
    },
  }));
}

function convertResponse(openaiResponse) {
  const choice = openaiResponse.choices?.[0];
  if (!choice) return makeErrorResponse('No response from model');

  const message = choice.message;
  const content = [];

  if (message.content) {
    content.push({ type: 'text', text: message.content });
  }

  if (message.tool_calls?.length > 0) {
    for (const tc of message.tool_calls) {
      let input = {};
      try { input = JSON.parse(tc.function.arguments || '{}'); } catch {}
      content.push({
        type: 'tool_use',
        id: tc.id || `tool_${Date.now()}`,
        name: tc.function.name,
        input,
      });
    }
  }

  if (content.length === 0) content.push({ type: 'text', text: '' });

  return {
    id: `msg_${Date.now()}`,
    type: 'message',
    role: 'assistant',
    content,
    model: openaiResponse.model || 'local',
    stop_reason: choice.finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: openaiResponse.usage?.prompt_tokens || 0,
      output_tokens: openaiResponse.usage?.completion_tokens || 0,
    },
  };
}

function makeErrorResponse(msg) {
  return {
    id: `msg_err_${Date.now()}`,
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: `[Proxy Error: ${msg}]` }],
    model: 'local',
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 0, output_tokens: 0 },
  };
}

function sendSSE(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function streamAnthropicResponse(res, anthropicResponse) {
  const msgId = anthropicResponse.id;

  sendSSE(res, 'message_start', {
    type: 'message_start',
    message: {
      id: msgId,
      type: 'message',
      role: 'assistant',
      content: [],
      model: anthropicResponse.model,
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: anthropicResponse.usage.input_tokens || 0, output_tokens: 0 },
    },
  });

  let blockIndex = 0;

  for (const block of anthropicResponse.content) {
    if (block.type === 'text') {
      sendSSE(res, 'content_block_start', {
        type: 'content_block_start',
        index: blockIndex,
        content_block: { type: 'text', text: '' },
      });

      const chunkSize = 20;
      for (let i = 0; i < block.text.length; i += chunkSize) {
        sendSSE(res, 'content_block_delta', {
          type: 'content_block_delta',
          index: blockIndex,
          delta: { type: 'text_delta', text: block.text.slice(i, i + chunkSize) },
        });
      }

      sendSSE(res, 'content_block_stop', {
        type: 'content_block_stop',
        index: blockIndex,
      });

    } else if (block.type === 'tool_use') {
      sendSSE(res, 'content_block_start', {
        type: 'content_block_start',
        index: blockIndex,
        content_block: { type: 'tool_use', id: block.id, name: block.name, input: {} },
      });

      sendSSE(res, 'content_block_delta', {
        type: 'content_block_delta',
        index: blockIndex,
        delta: { type: 'input_json_delta', partial_json: JSON.stringify(block.input) },
      });

      sendSSE(res, 'content_block_stop', {
        type: 'content_block_stop',
        index: blockIndex,
      });
    }

    blockIndex++;
  }

  sendSSE(res, 'message_delta', {
    type: 'message_delta',
    delta: { stop_reason: anthropicResponse.stop_reason, stop_sequence: null },
    usage: { output_tokens: anthropicResponse.usage.output_tokens || 0 },
  });

  sendSSE(res, 'message_stop', { type: 'message_stop' });

  res.end();
}

function callLMStudio(payload) {
  return new Promise((resolve, reject) => {
    // Override stream manually for tool-handling capabilities
    const body = JSON.stringify({ ...payload, stream: false });
    const options = {
      hostname: 'localhost',
      port: 1234,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = http.request(options, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`LM Studio parse error: ${data.slice(0, 200)}`)); }
      });
    });

    req.on('error', reject);
    req.setTimeout(300000, () => reject(new Error('LM Studio timeout (5min)')));
    req.write(body);
    req.end();
  });
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method !== 'POST' || !req.url.includes('/v1/messages')) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  let body = '';
  req.on('data', chunk => (body += chunk));
  req.on('end', async () => {
    let anthropicRequest;
    try {
      anthropicRequest = JSON.parse(body);
    } catch {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    const isStream = anthropicRequest.stream === true;

    console.log(`\n→ [${new Date().toLocaleTimeString()}] Request Received`);
    console.log(`  Model: ${anthropicRequest.model}`);
    console.log(`  Messages: ${anthropicRequest.messages?.length}`);
    console.log(`  Tools: ${anthropicRequest.tools?.length || 0}`);
    console.log(`  Stream: ${isStream}`);

    try {
      const systemContent = Array.isArray(anthropicRequest.system)
        ? anthropicRequest.system.map(s => (typeof s === 'string' ? s : s.text || '')).join('\n')
        : anthropicRequest.system || '';

      const openaiMessages = [];
      if (systemContent) openaiMessages.push({ role: 'system', content: systemContent });
      openaiMessages.push(...convertMessages(anthropicRequest.messages));

      const payload = {
        model: 'local-model',
        messages: openaiMessages,
        max_tokens: anthropicRequest.max_tokens || 4096,
        temperature: anthropicRequest.temperature ?? 0.7,
      };

      const tools = convertTools(anthropicRequest.tools);
      if (tools) {
        payload.tools = tools;
        payload.tool_choice = 'auto';
      }

      const lmResponse = await callLMStudio(payload);

      if (lmResponse.error) {
        console.error('  ✗ LM Studio Error:', lmResponse.error.message);
        const errResp = makeErrorResponse(lmResponse.error.message);
        res.writeHead(200, { 'Content-Type': isStream ? 'text/event-stream' : 'application/json', 'Cache-Control': 'no-cache' });
        if (isStream) streamAnthropicResponse(res, errResp);
        else res.end(JSON.stringify(errResp));
        return;
      }

      const anthropicResponse = convertResponse(lmResponse);
      const toolCount = anthropicResponse.content.filter(b => b.type === 'tool_use').length;
      console.log(`  ✓ Output: ${anthropicResponse.usage?.output_tokens || 0} tokens, ${toolCount} tool calls`);

      if (isStream) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });
        streamAnthropicResponse(res, anthropicResponse);
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(anthropicResponse));
      }

    } catch (err) {
      console.error('  ✗ Proxy Error:', err.message);
      const errResp = makeErrorResponse(err.message);
      if (isStream) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
        streamAnthropicResponse(res, errResp);
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { type: 'api_error', message: err.message } }));
      }
    }
  });
});

server.listen(PROXY_PORT, () => {
  console.log('╔════════════════════════════════════════╗');
  console.log('║    ByIbosCode Local Proxy v2.0         ║');
  console.log('╠════════════════════════════════════════╣');
  console.log(`║  Proxy Listen → http://localhost:${PROXY_PORT}     ║`);
  console.log('║  LM Studio    → http://localhost:1234  ║');
  console.log('╠════════════════════════════════════════╣');
  console.log('║  Fake-Stream + Tool Call Support!      ║');
  console.log('╚════════════════════════════════════════╝\n');
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PROXY_PORT} is in use! Close the existing proxy first.`);
  } else {
    console.error('Server error:', err);
  }
});
