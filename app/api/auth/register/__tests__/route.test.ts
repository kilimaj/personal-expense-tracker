import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock external dependencies before importing the route handler.
// The route module is side-effect free but imports modules that hit the
// network/database, so we mock those at the module boundary.
// ---------------------------------------------------------------------------

vi.mock('@/lib/db', () => ({
  connectToDatabase: vi.fn().mockResolvedValue(undefined),
  User: {
    findOne: vi.fn(),
    create: vi.fn(),
  },
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
  },
}))

// next/server is mocked so we can inspect the response without needing the
// full Next.js runtime.
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    })),
  },
}))

import { POST } from '../route'
import { connectToDatabase, User } from '@/lib/db'
import bcrypt from 'bcryptjs'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// The mock for NextResponse.json returns a plain object, not a real Response.
// We use this type throughout the tests to avoid fighting the DOM lib types.
type MockResponse = { body: unknown; status: number }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown): Request {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Request
}

function makeMalformedRequest(): Request {
  return {
    json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
  } as unknown as Request
}

async function call(body: unknown): Promise<MockResponse> {
  const res = await POST(makeRequest(body))
  return res as unknown as MockResponse
}

async function callMalformed(): Promise<MockResponse> {
  const res = await POST(makeMalformedRequest())
  return res as unknown as MockResponse
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/auth/register', () => {
  const validBody = {
    firstName: 'John',
    lastName: 'Kilima',
    email: 'john@example.com',
    password: 'securepass1',
    confirm: 'securepass1',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Default: no existing user
    vi.mocked(User.findOne).mockResolvedValue(null)
    vi.mocked(User.create).mockResolvedValue({} as never)
    vi.mocked(bcrypt.hash).mockResolvedValue('hashed_password' as never)
  })

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  describe('success (201)', () => {
    it('should create a user and return { success: true } with status 201', async () => {
      // Act
      const res = await call(validBody)

      // Assert
      expect(res.status).toBe(201)
      expect(res.body).toEqual({ success: true })
    })

    it('should hash the password before storing', async () => {
      // Act
      await call(validBody)

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith(validBody.password, 12)
    })

    it('should call connectToDatabase before querying', async () => {
      // Act
      await call(validBody)

      // Assert — connectToDatabase must be called before User.findOne
      const connectOrder = vi.mocked(connectToDatabase).mock.invocationCallOrder[0]
      const findOrder = vi.mocked(User.findOne).mock.invocationCallOrder[0]
      expect(connectOrder).toBeLessThan(findOrder)
    })

    it('should store a lower-cased email (schema transform)', async () => {
      // Act
      await call({ ...validBody, email: 'JOHN@EXAMPLE.COM' })

      // Assert — User.findOne receives lower-cased email from Zod transform
      expect(User.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'john@example.com' }),
      )
    })

    it('should trim firstName and lastName before creating the user', async () => {
      // Act
      await call({ ...validBody, firstName: '  John  ', lastName: '  Kilima  ' })

      // Assert
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'John', lastName: 'Kilima' }),
      )
    })
  })

  // -------------------------------------------------------------------------
  // Malformed request body
  // -------------------------------------------------------------------------

  describe('malformed body (400)', () => {
    it('should return 400 with "Invalid request body" when body is not JSON', async () => {
      // Act
      const res = await callMalformed()

      // Assert
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'Invalid request body' })
    })

    it('should not call connectToDatabase when the body is malformed', async () => {
      // Act
      await callMalformed()

      // Assert
      expect(connectToDatabase).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Zod validation failures (400)
  // -------------------------------------------------------------------------

  describe('validation failures (400)', () => {
    it('should return 400 with "Validation failed" when email is missing', async () => {
      // Arrange
      const { email: _omit, ...body } = validBody

      // Act
      const res = await call(body)

      // Assert
      expect(res.status).toBe(400)
      expect((res.body as Record<string, unknown>).error).toBe('Validation failed')
    })

    it('should include a fields map in the response for validation errors', async () => {
      // Act
      const res = await call({ ...validBody, email: 'bad-email' })

      // Assert
      const body = res.body as Record<string, unknown>
      expect(res.status).toBe(400)
      expect(body.fields).toBeDefined()
      expect(typeof body.fields).toBe('object')
    })

    it('should return 400 when password is too short', async () => {
      // Act
      const res = await call({ ...validBody, password: 'short', confirm: 'short' })

      // Assert
      expect(res.status).toBe(400)
    })

    it('should return 400 when passwords do not match', async () => {
      // Act
      const res = await call({ ...validBody, confirm: 'mismatch' })

      // Assert
      expect(res.status).toBe(400)
      const body = res.body as Record<string, unknown>
      const fields = body.fields as Record<string, string>
      expect(fields['confirm']).toBe('Passwords do not match')
    })

    it('should not call User.findOne when validation fails', async () => {
      // Act
      await call({ ...validBody, email: '' })

      // Assert
      expect(User.findOne).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Duplicate email (409)
  // -------------------------------------------------------------------------

  describe('duplicate email (409)', () => {
    it('should return 409 with a generic error when the email already exists', async () => {
      // Arrange
      vi.mocked(User.findOne).mockResolvedValue({ email: validBody.email } as never)

      // Act
      const res = await call(validBody)

      // Assert
      expect(res.status).toBe(409)
      expect(res.body).toEqual({ error: 'Unable to create account' })
    })

    it('should not reveal that the email is already registered', async () => {
      // Arrange
      vi.mocked(User.findOne).mockResolvedValue({ email: validBody.email } as never)

      // Act
      const res = await call(validBody)

      // Assert — message must not confirm existence of the account
      const body = res.body as Record<string, unknown>
      expect(body.error).not.toMatch(/already/i)
      expect(body.error).not.toMatch(/registered/i)
      expect(body.error).not.toMatch(/exists/i)
    })

    it('should not call bcrypt.hash when a duplicate email is detected', async () => {
      // Arrange
      vi.mocked(User.findOne).mockResolvedValue({ email: validBody.email } as never)

      // Act
      await call(validBody)

      // Assert
      expect(bcrypt.hash).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Database / unexpected errors (500)
  // -------------------------------------------------------------------------

  describe('unexpected server errors (500)', () => {
    it('should return 500 with a generic message when connectToDatabase throws', async () => {
      // Arrange
      vi.mocked(connectToDatabase).mockRejectedValueOnce(new Error('ECONNREFUSED'))

      // Act
      const res = await call(validBody)

      // Assert
      expect(res.status).toBe(500)
      expect(res.body).toEqual({
        error: 'Something went wrong. Please try again.',
      })
    })

    it('should return 500 with a generic message when User.create throws', async () => {
      // Arrange
      vi.mocked(User.create).mockRejectedValueOnce(new Error('MongoServerError'))

      // Act
      const res = await call(validBody)

      // Assert
      expect(res.status).toBe(500)
      expect(res.body).toEqual({
        error: 'Something went wrong. Please try again.',
      })
    })

    it('should not expose internal error details in the 500 response', async () => {
      // Arrange
      vi.mocked(User.create).mockRejectedValueOnce(new Error('secret db error'))

      // Act
      const res = await call(validBody)

      // Assert
      const bodyStr = JSON.stringify(res.body)
      expect(bodyStr).not.toContain('secret db error')
    })
  })
})
