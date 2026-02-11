const ev = {
  on: jest.fn(),
  removeAllListeners: jest.fn(),
  emit: jest.fn(),
};

const socketMock = {
  ev,
  user: { id: 'test' },
  sendMessage: jest.fn(),
  logout: jest.fn(),
};

module.exports = {
  default: jest.fn(() => socketMock),
  useMultiFileAuthState: jest.fn().mockResolvedValue({ state: {}, saveCreds: jest.fn() }),
  makeWASocket: jest.fn(() => socketMock),
  DisconnectReason: {
    badSession: 500,
    connectionClosed: 428,
    connectionLost: 408,
    connectionReplaced: 440,
    restartRequired: 515,
    timedOut: 408,
  },
  Browsers: {
    ubuntu: jest.fn(),
    macOS: jest.fn(),
    baileys: jest.fn(),
  },
  proto: {
    WebMessageInfo: {
      create: jest.fn(),
      encode: jest.fn(),
      decode: jest.fn(),
    }
  }
};
