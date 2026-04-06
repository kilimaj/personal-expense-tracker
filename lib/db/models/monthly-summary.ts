import mongoose, { Document, Model, Schema, Types } from 'mongoose'

export interface ICategorySummary {
  categoryId: Types.ObjectId
  categoryName: string
  totalAmount: number
  transactionCount: number
}

export interface IMonthlySummary {
  userId: Types.ObjectId
  year: number
  month: number
  totalAmount: number
  transactionCount: number
  byCategory: ICategorySummary[]
  updatedAt: Date
}

export type MonthlySummaryDocument = IMonthlySummary & Document

const categorySummarySchema = new Schema<ICategorySummary>(
  {
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'ExpenseCategory',
      required: true,
    },
    // Denormalised to avoid a join on every dashboard read.
    // Recalculated whenever the summary is rebuilt.
    categoryName: {
      type: String,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    transactionCount: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { _id: false } // sub-documents don't need their own _id
)

const monthlySummarySchema = new Schema<MonthlySummaryDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
    },
    month: {
      type: Number,
      required: [true, 'Month is required'],
      min: [1, 'Month must be between 1 and 12'],
      max: [12, 'Month must be between 1 and 12'],
    },
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    transactionCount: {
      type: Number,
      required: true,
      default: 0,
    },
    byCategory: {
      type: [categorySummarySchema],
      default: [],
    },
  },
  {
    timestamps: { createdAt: false, updatedAt: true }, // only track updatedAt
  }
)

// One summary document per user per month — also the primary lookup key
monthlySummarySchema.index({ userId: 1, year: 1, month: 1 }, { unique: true })

export const MonthlySummary: Model<MonthlySummaryDocument> =
  (mongoose.models.MonthlySummary as Model<MonthlySummaryDocument>) ||
  mongoose.model<MonthlySummaryDocument>('MonthlySummary', monthlySummarySchema)
