import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error(
    'MONGODB_URI environment variable is not defined. ' +
    'Add it to .env.local for development.'
  )
}

// Extend the global type to hold the cached connection across Next.js hot-reloads.
// The Node.js process is not restarted on hot-reload, but modules are re-evaluated —
// caching on global prevents opening new connections on every reload.
declare global {
  var __mongoose:
    | {
        conn: typeof mongoose | null
        promise: Promise<typeof mongoose> | null
      }
    | undefined
}

const cached = global.__mongoose ?? (global.__mongoose = { conn: null, promise: null })

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI!, {
      bufferCommands: false, // surface missing awaits loudly instead of silently queuing
    })
  }

  cached.conn = await cached.promise
  return cached.conn
}
