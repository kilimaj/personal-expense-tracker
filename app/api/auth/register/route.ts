import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectToDatabase, User } from '@/lib/db'
import { registerSchema } from '@/lib/validations/auth'
import { formatZodErrors } from '@/lib/validations/utils'

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const result = registerSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', fields: formatZodErrors(result.error) },
      { status: 400 },
    )
  }

  const { firstName, lastName, email, password } = result.data

  try {
    await connectToDatabase()

    const existing = await User.findOne({ email })
    if (existing) {
      return NextResponse.json(
        { error: 'Unable to create account' },
        { status: 409 },
      )
    }

    const passwordHash = await bcrypt.hash(password, 12)

    await User.create({
      firstName: firstName.trim(),
      lastName:  lastName.trim(),
      email,
      passwordHash,
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 },
    )
  }
}
