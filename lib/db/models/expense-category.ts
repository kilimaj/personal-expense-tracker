import mongoose, { Document, Model, Schema, Types } from 'mongoose'

export interface IExpenseCategory {
  userId: Types.ObjectId
  name: string
  icon: string
  color: string
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

export type ExpenseCategoryDocument = IExpenseCategory & Document

const expenseCategorySchema = new Schema<ExpenseCategoryDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    icon: {
      type: String,
      required: [true, 'Icon is required'],
      trim: true,
    },
    color: {
      type: String,
      required: [true, 'Color is required'],
      trim: true,
      match: [/^#([0-9a-fA-F]{6})$/, 'Color must be a valid hex code (e.g. #a3b4c5)'],
    },
    isDefault: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  { timestamps: true }
)

// One user cannot have two categories with the same name
expenseCategorySchema.index({ userId: 1, name: 1 }, { unique: true })

export const ExpenseCategory: Model<ExpenseCategoryDocument> =
  (mongoose.models.ExpenseCategory as Model<ExpenseCategoryDocument>) ||
  mongoose.model<ExpenseCategoryDocument>('ExpenseCategory', expenseCategorySchema)
