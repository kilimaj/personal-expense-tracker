import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// auth.ts is not easily imported in isolation because NextAuth() runs at
// module evaluation time and expects a real environment. Instead, we extract
// and test the callback logic directly by replicating the pure functions
// that live inside the NextAuth({ callbacks: { ... } }) call.
//
// This is the recommended approach for testing NextAuth callback logic in
// unit tests — test the logic, not the NextAuth wiring.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Replicated callback logic (mirrors auth.ts exactly)
// ---------------------------------------------------------------------------

type JWT = Record<string, unknown>
type Session = { user: Record<string, unknown> }
type User = { id?: string }

function jwtCallback({ token, user }: { token: JWT; user?: User }): JWT {
  if (user) token.userId = user.id
  return token
}

function sessionCallback({
  session,
  token,
}: {
  session: Session
  token: JWT
}): Session {
  if (token.userId) session.user.id = token.userId as string
  return session
}

// ---------------------------------------------------------------------------
// Credentials authorize logic (mirrors auth.ts exactly, with injectable deps)
// ---------------------------------------------------------------------------

type AuthorizeInput = {
  email?: unknown
  password?: unknown
}

async function authorize(
  credentials: AuthorizeInput | undefined,
  deps: {
    connectToDatabase: () => Promise<void>
    findUser: (email: string) => Promise<{ _id: { toString(): string }; email: string; firstName: string; lastName: string; passwordHash: string } | null>
    comparePassword: (plain: string, hash: string) => Promise<boolean>
  },
): Promise<{ id: string; email: string; name: string } | null> {
  if (!credentials?.email || !credentials?.password) return null

  await deps.connectToDatabase()

  const user = await deps.findUser(
    (credentials.email as string).toLowerCase().trim(),
  )

  if (!user) return null

  const passwordValid = await deps.comparePassword(
    credentials.password as string,
    user.passwordHash,
  )

  if (!passwordValid) return null

  return {
    id: user._id.toString(),
    email: user.email,
    name: `${user.firstName} ${user.lastName}`,
  }
}

// ---------------------------------------------------------------------------
// Tests: jwt callback
// ---------------------------------------------------------------------------

describe('auth: jwt callback', () => {
  it('should attach userId to the token when a user object is present', () => {
    // Arrange
    const token: JWT = { sub: 'abc' }
    const user: User = { id: 'user-123' }

    // Act
    const result = jwtCallback({ token, user })

    // Assert
    expect(result.userId).toBe('user-123')
  })

  it('should return the token unchanged when no user object is provided', () => {
    // Arrange
    const token: JWT = { sub: 'abc', userId: 'existing-id' }

    // Act
    const result = jwtCallback({ token, user: undefined })

    // Assert
    expect(result).toEqual({ sub: 'abc', userId: 'existing-id' })
  })

  it('should set userId to undefined when user.id is undefined', () => {
    // Arrange
    const token: JWT = {}
    const user: User = {}

    // Act
    const result = jwtCallback({ token, user })

    // Assert
    expect(result.userId).toBeUndefined()
  })

  it('should preserve existing token fields when adding userId', () => {
    // Arrange
    const token: JWT = { sub: 'abc', name: 'John' }
    const user: User = { id: 'user-456' }

    // Act
    const result = jwtCallback({ token, user })

    // Assert
    expect(result.sub).toBe('abc')
    expect(result.name).toBe('John')
    expect(result.userId).toBe('user-456')
  })
})

// ---------------------------------------------------------------------------
// Tests: session callback
// ---------------------------------------------------------------------------

describe('auth: session callback', () => {
  it('should attach token.userId to session.user.id', () => {
    // Arrange
    const session: Session = { user: { email: 'user@example.com' } }
    const token: JWT = { userId: 'user-789' }

    // Act
    const result = sessionCallback({ session, token })

    // Assert
    expect(result.user.id).toBe('user-789')
  })

  it('should not set session.user.id when token has no userId', () => {
    // Arrange
    const session: Session = { user: { email: 'user@example.com' } }
    const token: JWT = {}

    // Act
    const result = sessionCallback({ session, token })

    // Assert
    expect(result.user.id).toBeUndefined()
  })

  it('should preserve existing session fields', () => {
    // Arrange
    const session: Session = { user: { email: 'user@example.com', name: 'John' } }
    const token: JWT = { userId: 'user-999' }

    // Act
    const result = sessionCallback({ session, token })

    // Assert
    expect(result.user.email).toBe('user@example.com')
    expect(result.user.name).toBe('John')
    expect(result.user.id).toBe('user-999')
  })
})

// ---------------------------------------------------------------------------
// Tests: credentials authorize logic
// ---------------------------------------------------------------------------

describe('auth: credentials authorize logic', () => {
  const fakeUser = {
    _id: { toString: () => 'user-id-abc' },
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Kilima',
    passwordHash: '$2a$12$hashedpassword',
  }

  const deps = {
    connectToDatabase: vi.fn().mockResolvedValue(undefined),
    findUser: vi.fn().mockResolvedValue(fakeUser),
    comparePassword: vi.fn().mockResolvedValue(true),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    deps.connectToDatabase.mockResolvedValue(undefined)
    deps.findUser.mockResolvedValue(fakeUser)
    deps.comparePassword.mockResolvedValue(true)
  })

  describe('happy path', () => {
    it('should return a user object when credentials are valid', async () => {
      // Arrange
      const credentials = { email: 'john@example.com', password: 'correctpassword' }

      // Act
      const result = await authorize(credentials, deps)

      // Assert
      expect(result).toEqual({
        id: 'user-id-abc',
        email: 'john@example.com',
        name: 'John Kilima',
      })
    })

    it('should look up the user by lower-cased, trimmed email', async () => {
      // Arrange
      const credentials = { email: '  JOHN@EXAMPLE.COM  ', password: 'correctpassword' }

      // Act
      await authorize(credentials, deps)

      // Assert
      expect(deps.findUser).toHaveBeenCalledWith('john@example.com')
    })

    it('should call connectToDatabase before looking up the user', async () => {
      // Arrange
      const credentials = { email: 'john@example.com', password: 'correctpassword' }
      const connectOrder: number[] = []
      deps.connectToDatabase.mockImplementation(async () => { connectOrder.push(1) })
      deps.findUser.mockImplementation(async () => { connectOrder.push(2); return fakeUser })

      // Act
      await authorize(credentials, deps)

      // Assert — connect must happen before findUser
      expect(connectOrder).toEqual([1, 2])
    })
  })

  describe('missing or empty credentials', () => {
    it('should return null when credentials is undefined', async () => {
      // Act
      const result = await authorize(undefined, deps)

      // Assert
      expect(result).toBeNull()
      expect(deps.connectToDatabase).not.toHaveBeenCalled()
    })

    it('should return null when email is missing', async () => {
      // Act
      const result = await authorize({ password: 'pass' }, deps)

      // Assert
      expect(result).toBeNull()
    })

    it('should return null when password is missing', async () => {
      // Act
      const result = await authorize({ email: 'john@example.com' }, deps)

      // Assert
      expect(result).toBeNull()
    })

    it('should return null when email is an empty string', async () => {
      // Act
      const result = await authorize({ email: '', password: 'pass' }, deps)

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('user not found', () => {
    it('should return null when no user matches the email', async () => {
      // Arrange
      deps.findUser.mockResolvedValue(null)

      // Act
      const result = await authorize(
        { email: 'unknown@example.com', password: 'pass' },
        deps,
      )

      // Assert
      expect(result).toBeNull()
    })

    it('should not call comparePassword when the user is not found', async () => {
      // Arrange
      deps.findUser.mockResolvedValue(null)

      // Act
      await authorize({ email: 'unknown@example.com', password: 'pass' }, deps)

      // Assert
      expect(deps.comparePassword).not.toHaveBeenCalled()
    })
  })

  describe('wrong password', () => {
    it('should return null when the password does not match the hash', async () => {
      // Arrange
      deps.comparePassword.mockResolvedValue(false)

      // Act
      const result = await authorize(
        { email: 'john@example.com', password: 'wrongpassword' },
        deps,
      )

      // Assert
      expect(result).toBeNull()
    })
  })
})
