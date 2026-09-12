import { z } from "zod";

// Allowed complaint categories (allowlist for security)
const ALLOWED_CATEGORIES = [
  "wrong_item",
  "missing_item",
  "late_delivery",
  "damaged_item",
  "quality_issue",
  "reorder",
  "payment_issue",
  "other",
] as const;

// Attachment schema for file uploads
export const AttachmentSchema = z.object({
  filename: z
    .string()
    .max(255)
    .regex(/^[a-zA-Z0-9._-]+$/, "Filename contains invalid characters"),
  storage_path: z.string().max(500),
  file_type: z.string().max(100),
  file_size_bytes: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024), // Max 10MB
});

export const CreateComplaintSchema = z.object({
  order_id: z.string().min(1).max(100),
  category: z.enum(ALLOWED_CATEGORIES),
  details: z.string().min(10).max(5000),
  attachments: z.array(AttachmentSchema).max(10).optional(), // Max 10 attachments
});

export const RequestSupportSchema = z.object({
  complaint_id: z.string().min(1).max(100),
});

export const UploadUrlSchema = z.object({
  filename: z
    .string()
    .max(255)
    .regex(/^[a-zA-Z0-9._-]+$/, "Filename contains invalid characters"),
  content_type: z.string().max(100),
});

// Pagination and filtering schemas
export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().max(1000).default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const ComplaintFilterSchema = z
  .object({
    status: z.string().optional(),
    priority: z.string().optional(),
    category: z.string().optional(),
  })
  .merge(PaginationSchema);

// Chatbot message schema
export const ChatbotMessageSchema = z.object({
  message: z.string().min(1).max(1000),
});

export const ChatbotMessagesSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(1000),
        timestamp: z.any().optional(), // Allow any date format
      }),
    )
    .max(50), // Max 50 messages in conversation history
});
