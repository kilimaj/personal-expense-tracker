import mongoose, { Document, Model, Schema, Types } from 'mongoose'

export interface IExpense {
  userId: Types.ObjectId
  categoryId: Types.ObjectId
  amount: number
  description?: string
  notes?: string
  date: Date
  createdAt: Date
  updatedAt: Date
}

export type ExpenseDocument = IExpense & Document

const expenseSchema = new Schema<ExpenseDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'ExpenseCategory',
      required: [true, 'categoryId is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, 'Description cannot exceed 200 characters'],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
  },
  { timestamps: true }
)

// Powers chronological listings and date-range queries
expenseSchema.index({ userId: 1, date: -1 })

// Powers per-category filtering and category breakdown
expenseSchema.index({ userId: 1, categoryId: 1 })

export const Expense: Model<ExpenseDocument> =
  (mongoose.models.Expense as Model<ExpenseDocument>) ||
  mongoose.model<ExpenseDocument>('Expense', expenseSchema)
