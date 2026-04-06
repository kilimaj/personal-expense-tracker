import { describe, it, expect } from 'vitest'
import { loginSchema, registerSchema } from '../auth'

// ---------------------------------------------------------------------------
// loginSchema
// ---------------------------------------------------------------------------

describe('loginSchema', () => {
  describe('valid inputs', () => {
    it('should accept a valid email and password', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: 'secret123',
      })
      expect(result.success).toBe(true)
    })

    it('should trim leading and trailing whitespace from email', () => {
      const result = loginSchema.safeParse({
        email: '  user@example.com  ',
        password: 'secret123',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.email).toBe('user@example.com')
      }
    })
  })

  describe('email validation', () => {
    it('should reject an empty email', () => {
      const result = loginSchema.safeParse({ email: '', password: 'secret123' })
      expect(result.success).toBe(false)
      if (!result.success) {
        const emailErrors = result.error.issues.filter((i) => i.path[0] === 'email')
        expect(emailErrors.length).toBeGreaterThan(0)
      }
    })

    it('should reject an email with no @ symbol', () => {
      const result = loginSchema.safeParse({
        email: 'notanemail',
        password: 'secret123',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const emailIssue = result.error.issues.find((i) => i.path[0] === 'email')
        expect(emailIssue?.message).toBe('Enter a valid email address')
      }
    })

    it('should reject an email missing the domain part', () => {
      const result = loginSchema.safeParse({
        email: 'user@',
        password: 'secret123',
      })
      expect(result.success).toBe(false)
    })

    it('should reject a non-string email', () => {
      const result = loginSchema.safeParse({ email: 12345, password: 'secret123' })
      expect(result.success).toBe(false)
    })
  })

  describe('password validation', () => {
    it('should reject an empty password', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: '',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const pwIssue = result.error.issues.find((i) => i.path[0] === 'password')
        expect(pwIssue?.message).toBe('Password is required')
      }
    })

    it('should reject a missing password field', () => {
      const result = loginSchema.safeParse({ email: 'user@example.com' })
      expect(result.success).toBe(false)
    })

    it('should accept a single-character password (loginSchema has no min length)', () => {
      // loginSchema only requires the field is non-empty — length is not constrained
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: 'x',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('missing fields', () => {
    it('should reject when both email and password are missing', () => {
      const result = loginSchema.safeParse({})
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThanOrEqual(2)
      }
    })
  })
})

// ---------------------------------------------------------------------------
// registerSchema
// ---------------------------------------------------------------------------

describe('registerSchema', () => {
  const validPayload = {
    firstName: 'John',
    lastName: 'Kilima',
    email: 'john@example.com',
    password: 'securepass1',
    confirm: 'securepass1',
  }

  describe('valid inputs', () => {
    it('should accept a fully valid registration payload', () => {
      const result = registerSchema.safeParse(validPayload)
      expect(result.success).toBe(true)
    })

    it('should lower-case the email via transform', () => {
      const result = registerSchema.safeParse({
        ...validPayload,
        email: 'JOHN@EXAMPLE.COM',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.email).toBe('john@example.com')
      }
    })

    it('should trim whitespace from firstName', () => {
      const result = registerSchema.safeParse({
        ...validPayload,
        firstName: '  John  ',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.firstName).toBe('John')
      }
    })

    it('should trim whitespace from lastName', () => {
      const result = registerSchema.safeParse({
        ...validPayload,
        lastName: '  Kilima  ',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.lastName).toBe('Kilima')
      }
    })
  })

  describe('firstName validation', () => {
    it('should reject an empty firstName', () => {
      const result = registerSchema.safeParse({ ...validPayload, firstName: '' })
      expect(result.success).toBe(false)
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === 'firstName')
        expect(issue?.message).toBe('First name is required')
      }
    })

    it('should reject a firstName exceeding 50 characters', () => {
      const result = registerSchema.safeParse({
        ...validPayload,
        firstName: 'A'.repeat(51),
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === 'firstName')
        expect(issue?.message).toBe('First name is too long')
      }
    })

    it('should accept a firstName of exactly 50 characters', () => {
      const result = registerSchema.safeParse({
        ...validPayload,
        firstName: 'A'.repeat(50),
      })
      expect(result.success).toBe(true)
    })

    it('should reject a missing firstName', () => {
      const { firstName: _omit, ...rest } = validPayload
      const result = registerSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })
  })

  describe('lastName validation', () => {
    it('should reject an empty lastName', () => {
      const result = registerSchema.safeParse({ ...validPayload, lastName: '' })
      expect(result.success).toBe(false)
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === 'lastName')
        expect(issue?.message).toBe('Last name is required')
      }
    })

    it('should reject a lastName exceeding 50 characters', () => {
      const result = registerSchema.safeParse({
        ...validPayload,
        lastName: 'B'.repeat(51),
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === 'lastName')
        expect(issue?.message).toBe('Last name is too long')
      }
    })

    it('should accept a lastName of exactly 50 characters', () => {
      const result = registerSchema.safeParse({
        ...validPayload,
        lastName: 'B'.repeat(50),
      })
      expect(result.success).toBe(true)
    })
  })

  describe('email validation', () => {
    it('should reject an empty email', () => {
      const result = registerSchema.safeParse({ ...validPayload, email: '' })
      expect(result.success).toBe(false)
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === 'email')
        expect(issue).toBeDefined()
      }
    })

    it('should reject a malformed email', () => {
      const result = registerSchema.safeParse({
        ...validPayload,
        email: 'not-an-email',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === 'email')
        expect(issue?.message).toBe('Enter a valid email address')
      }
    })
  })

  describe('password validation', () => {
    it('should reject a password shorter than 8 characters', () => {
      const result = registerSchema.safeParse({
        ...validPayload,
        password: 'short',
        confirm: 'short',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === 'password')
        expect(issue?.message).toBe('Password must be at least 8 characters')
      }
    })

    it('should accept a password of exactly 8 characters', () => {
      const result = registerSchema.safeParse({
        ...validPayload,
        password: '12345678',
        confirm: '12345678',
      })
      expect(result.success).toBe(true)
    })

    it('should reject an empty password', () => {
      const result = registerSchema.safeParse({
        ...validPayload,
        password: '',
        confirm: '',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('password confirmation (refine)', () => {
    it('should reject when password and confirm do not match', () => {
      const result = registerSchema.safeParse({
        ...validPayload,
        password: 'password123',
        confirm: 'differentpassword',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === 'confirm')
        expect(issue?.message).toBe('Passwords do not match')
      }
    })

    it('should reject an empty confirm field even when password is valid', () => {
      const result = registerSchema.safeParse({
        ...validPayload,
        confirm: '',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        // Either the min(1) fires or the refine fires — either way it's a confirm error
        const issue = result.error.issues.find((i) => i.path[0] === 'confirm')
        expect(issue).toBeDefined()
      }
    })

    it('should accept when password and confirm match exactly', () => {
      const result = registerSchema.safeParse({
        ...validPayload,
        password: 'matchingPass1',
        confirm: 'matchingPass1',
      })
      expect(result.success).toBe(true)
    })

    it('should treat passwords as case-sensitive', () => {
      const result = registerSchema.safeParse({
        ...validPayload,
        password: 'Password123',
        confirm: 'password123',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === 'confirm')
        expect(issue?.message).toBe('Passwords do not match')
      }
    })
  })

  describe('safeParse error shapes', () => {
    it('should produce field-keyed issues for multiple invalid fields', () => {
      const result = registerSchema.safeParse({
        firstName: '',
        lastName: '',
        email: 'bad',
        password: 'short',
        confirm: 'nomatch',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path[0])
        expect(paths).toContain('firstName')
        expect(paths).toContain('lastName')
        expect(paths).toContain('email')
        expect(paths).toContain('password')
      }
    })
  })
})
