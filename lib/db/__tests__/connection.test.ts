import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// connection.ts reads MONGODB_URI at module evaluation time and throws if it
// is absent. We must set the env var before importing the module.
//
// Because Vitest caches modules, we use vi.resetModules() + dynamic import
// in each test group to control the environment around module load.
// ---------------------------------------------------------------------------

const ORIGINAL_URI = process.env.MONGODB_URI

describe('connectToDatabase', () => {
  beforeEach(() => {
    vi.resetModules()
    // Clear any cached mongoose connection stored on global
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(global as any).__mongoose = undefined
  })

  afterEach(() => {
    // Restore original env var after each test
    if (ORIGINAL_URI === undefined) {
      delete process.env.MONGODB_URI
    } else {
      process.env.MONGODB_URI = ORIGINAL_URI
    }
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // Missing MONGODB_URI
  // -------------------------------------------------------------------------

  describe('when MONGODB_URI is not set', () => {
    it('should throw at module load time if MONGODB_URI is undefined', async () => {
      // Arrange
      delete process.env.MONGODB_URI

      // Act & Assert
      await expect(
        import('../connection'),
      ).rejects.toThrow('MONGODB_URI environment variable is not defined')
    })
  })

  // -------------------------------------------------------------------------
  // Happy-path caching behaviour
  // -------------------------------------------------------------------------

  describe('when MONGODB_URI is set', () => {
    beforeEach(() => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/test'
    })

    it('should return the cached connection on a second call without reconnecting', async () => {
      // Arrange — mock mongoose.connect to return a fake connection object
      const fakeConn = { readyState: 1 }
      const connectSpy = vi.fn().mockResolvedValue(fakeConn)

      vi.doMock('mongoose', () => ({
        default: {
          connect: connectSpy,
          models: {},
          model: vi.fn(),
        },
      }))

      const { connectToDatabase } = await import('../connection')

      // Act — call twice
      const first = await connectToDatabase()
      const second = await connectToDatabase()

      // Assert
      expect(connectSpy).toHaveBeenCalledTimes(1)
      expect(first).toBe(second)
    })

    it('should call mongoose.connect with bufferCommands: false', async () => {
      // Arrange
      const fakeConn = { readyState: 1 }
      const connectSpy = vi.fn().mockResolvedValue(fakeConn)

      vi.doMock('mongoose', () => ({
        default: {
          connect: connectSpy,
          models: {},
          model: vi.fn(),
        },
      }))

      const { connectToDatabase } = await import('../connection')

      // Act
      await connectToDatabase()

      // Assert
      expect(connectSpy).toHaveBeenCalledWith(
        'mongodb://localhost:27017/test',
        expect.objectContaining({ bufferCommands: false }),
      )
    })

    it('should propagate a connection error to the caller', async () => {
      // Arrange
      const connectSpy = vi
        .fn()
        .mockRejectedValue(new Error('ECONNREFUSED'))

      vi.doMock('mongoose', () => ({
        default: {
          connect: connectSpy,
          models: {},
          model: vi.fn(),
        },
      }))

      const { connectToDatabase } = await import('../connection')

      // Act & Assert
      await expect(connectToDatabase()).rejects.toThrow('ECONNREFUSED')
    })

    it('should reuse a cached promise if one is already in flight', async () => {
      // Arrange — simulate a slow connection
      let resolve: (v: unknown) => void
      const pendingPromise = new Promise((r) => {
        resolve = r
      })
      const connectSpy = vi.fn().mockReturnValue(pendingPromise)

      vi.doMock('mongoose', () => ({
        default: {
          connect: connectSpy,
          models: {},
          model: vi.fn(),
        },
      }))

      const { connectToDatabase } = await import('../connection')

      // Act — fire two calls without awaiting either immediately
      const p1 = connectToDatabase()
      const p2 = connectToDatabase()

      // Resolve the underlying connection
      resolve!({ readyState: 1 })

      await Promise.all([p1, p2])

      // Assert — mongoose.connect was only called once despite two concurrent calls
      expect(connectSpy).toHaveBeenCalledTimes(1)
    })
  })
})
