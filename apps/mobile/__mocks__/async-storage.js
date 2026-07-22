// @react-native-async-storage/async-storage 테스트용 인메모리 mock
const store = new Map();

module.exports = {
  __esModule: true,
  default: {
    getItem: jest.fn(key => Promise.resolve(store.get(key) ?? null)),
    setItem: jest.fn((key, value) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    removeItem: jest.fn(key => {
      store.delete(key);
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      store.clear();
      return Promise.resolve();
    }),
  },
};
