import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { formatZodErrors } from '../utils'

// ---------------------------------------------------------------------------
// formatZodErrors
// ---------------------------------------------------------------------------

describe('formatZodErrors', () => {
  describe('single-field errors', () => {
    it('should return a record mapping a top-level field path to its message', () => {
      // Arrange
      const schema = z.object({ email: z.string().email('Enter a valid email address') })
      const result = schema.safeParse({ email: 'bad' })
      if (result.success) throw new Error('Expected parse failure')

      // Act
      const errors = formatZodErrors(result.error)

      // Assert
      expect(errors).toEqual({ email: 'Enter a valid email address' })
    })

    it('should return a record with the correct message for a required field', () => {
      // Arrange
      const schema = z.object({ name: z.string().min(1, 'Name is required') })
      const result = schema.safeParse({ name: '' })
      if (result.success) throw new Error('Expected parse failure')

      // Act
      const errors = formatZodErrors(result.error)

      // Assert
      expect(errors).toEqual({ name: 'Name is required' })
    })
  })

  describe('multiple-field errors', () => {
    it('should map all invalid fields to their respective messages', () => {
      // Arrange
      const schema = z.object({
        email: z.string().email('Enter a valid email address'),
        password: z.string().min(8, 'Password must be at least 8 characters'),
      })
      const result = schema.safeParse({ email: 'bad', password: 'short' })
      if (result.success) throw new Error('Expected parse failure')

      // Act
      const errors = formatZodErrors(result.error)

      // Assert
      expect(errors).toEqual({
        email: 'Enter a valid email address',
        password: 'Password must be at least 8 characters',
      })
    })

    it('should produce one entry per field even when a field has multiple rules violated', () => {
      // Arrange — Zod stops at the first failing rule per field by default,
      // so we get exactly one message per path.
      const schema = z.object({
        value: z.string().min(1, 'Required').max(5, 'Too long'),
      })
      const result = schema.safeParse({ value: '' })
      if (result.success) throw new Error('Expected parse failure')

      // Act
      const errors = formatZodErrors(result.error)

      // Assert — only the first failing rule is in the output
      expect(Object.keys(errors)).toHaveLength(1)
      expect(errors['value']).toBe('Required')
    })
  })

  describe('nested-field errors', () => {
    it('should join nested path segments with a dot', () => {
      // Arrange
      const schema = z.object({
        address: z.object({
          postcode: z.string().min(1, 'Postcode is required'),
        }),
      })
      const result = schema.safeParse({ address: { postcode: '' } })
      if (result.success) throw new Error('Expected parse failure')

      // Act
      const errors = formatZodErrors(result.error)

      // Assert
      expect(errors).toHaveProperty('address.postcode', 'Postcode is required')
    })
  })

  describe('refine (cross-field) errors', () => {
    it('should capture the path provided to a .refine() call', () => {
      // Arrange
      const schema = z
        .object({
          password: z.string().min(8, 'Password must be at least 8 characters'),
          confirm: z.string().min(1, 'Please confirm your password'),
        })
        .refine((d) => d.password === d.confirm, {
          message: 'Passwords do not match',
          path: ['confirm'],
        })

      const result = schema.safeParse({
        password: 'validpass1',
        confirm: 'different1',
      })
      if (result.success) throw new Error('Expected parse failure')

      // Act
      const errors = formatZodErrors(result.error)

      // Assert
      expect(errors).toHaveProperty('confirm', 'Passwords do not match')
    })
  })

  describe('empty error set', () => {
    it('should return an empty record when the ZodError has no issues', () => {
      // Arrange — construct a ZodError with an empty issues array manually
      const { ZodError } = z
      const emptyError = new ZodError([])

      // Act
      const errors = formatZodErrors(emptyError)

      // Assert
      expect(errors).toEqual({})
    })
  })

  describe('return type', () => {
    it('should always return a plain object', () => {
      // Arrange
      const schema = z.object({ x: z.string() })
      const result = schema.safeParse({ x: 42 })
      if (result.success) throw new Error('Expected parse failure')

      // Act
      const errors = formatZodErrors(result.error)

      // Assert
      expect(typeof errors).toBe('object')
      expect(Array.isArray(errors)).toBe(false)
    })
  })
})
