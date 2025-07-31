import { beforeAll, afterEach, afterAll } from 'vitest'
import { server } from './mocks/server.js'

// Establish API mocking before all tests
beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'error',
  })
})

// Reset any request handlers that we may add during the tests,
// so they don't affect other tests
afterEach(() => {
  server.resetHandlers()
})

// Clean up after the tests are finished
afterAll(() => {
  server.close()
})

// Global test utilities
global.testUtils = {
  // Add any global test utilities here
}