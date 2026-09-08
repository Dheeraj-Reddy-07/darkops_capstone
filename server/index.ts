import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";

// Load environment variables (this will load the local .env)
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security and utility middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://*.supabase.co"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xssFilter: true,
  }),
);

// CORS configuration - restrict to specific origins in production
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ||
  process.env.VITE_FRONTEND_URL ||
  "http://localhost:5173"
).split(",");

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === "development") {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
    maxAge: 86400, // 24 hours
  }),
);

// Request size limits to prevent resource exhaustion
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Request correlation and logging middleware
import { addRequestId } from "./middleware/auth";
app.use(addRequestId);

app.use((req, res, next) => {
  const requestId = req.requestId || "unknown";
  console.log(
    `[${new Date().toISOString()}] [${requestId}] ${req.method} ${req.url} - IP: ${req.ip}`,
  );
  next();
});

// Basic health check route
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "DarkOps Express API is running",
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
  });
});

// Register API Routes
import authRoutes from "./routes/auth.routes";
import casesRoutes from "./routes/cases.routes";
import storesRoutes from "./routes/stores.routes";
import fraudRoutes from "./routes/fraud.routes";
import executiveRoutes from "./routes/executive.routes";
import customersRoutes from "./routes/customers.routes";
import searchRoutes from "./routes/search.routes";
import adminRoutes from "./routes/admin.routes";
import notificationsRoutes from "./routes/notifications.routes";
import supportRoutes from "./routes/support.routes";
import publicRoutes from "./routes/public.routes";
import securityRoutes from "./routes/security.routes";

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/cases", casesRoutes);
app.use("/api/v1/stores", storesRoutes);
app.use("/api/v1/fraud", fraudRoutes);
app.use("/api/v1/executive", executiveRoutes);
app.use("/api/v1/customers", customersRoutes);
app.use("/api/v1/search", searchRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/notifications", notificationsRoutes);
app.use("/api/v1/support", supportRoutes);
app.use("/api/v1/public", publicRoutes);
app.use("/api/v1/security", securityRoutes);

// Centralized error handler with enhanced security
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const requestId = req.requestId || "unknown";

  // Log error with request ID for correlation
  console.error(`[API_ERROR] [${requestId}] ${err.message}`, {
    statusCode: err.statusCode,
    errorCode: err.errorCode,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  const statusCode = err.statusCode || 500;
  const errorCode = err.errorCode || "INTERNAL_SERVER_ERROR";

  // Don't expose internal error details in production
  const isDevelopment = process.env.NODE_ENV === "development";

  res.status(statusCode).json({
    error: {
      code: errorCode,
      message: err.message || "An unexpected error occurred.",
      requestId,
      ...(isDevelopment && err.details ? { details: err.details } : {}),
      ...(isDevelopment ? { stack: err.stack } : {}),
    },
  });
});

// Handle 404 routes
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "The requested resource was not found.",
      requestId: req.requestId,
    },
  });
});

app.listen(PORT, () => {
  console.log(`DarkOps Express server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`Allowed origins: ${allowedOrigins.join(", ")}`);
});
