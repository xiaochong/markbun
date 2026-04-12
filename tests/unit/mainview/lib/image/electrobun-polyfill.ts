(globalThis as any).window = {
  __electrobunWebviewId: 1,
  __electrobunListeners: {},
  __markbunAI: {},
  __electrobun: {
    receiveMessageFromBun: () => {},
  },
};

class DummyWebSocket {
  constructor() {}
  send() {}
  close() {}
  addEventListener() {}
  removeEventListener() {}
  set onopen(_: any) {}
  set onclose(_: any) {}
  set onmessage(_: any) {}
  set onerror(_: any) {}
}

(globalThis as any).WebSocket = DummyWebSocket;

export {};
