import mongoose, { Document, Model, Schema } from 'mongoose'

export interface IUser {
  firstName: string
  lastName: string
  email: string
  passwordHash: string
  createdAt: Date
  updatedAt: Date
}

export type UserDocument = IUser & Document

const userSchema = new Schema<UserDocument>(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
    },
  },
  { timestamps: true }
)

export const User: Model<UserDocument> =
  (mongoose.models.User as Model<UserDocument>) ||
  mongoose.model<UserDocument>('User', userSchema)
