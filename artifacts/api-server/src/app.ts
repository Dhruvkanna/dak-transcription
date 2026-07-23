import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── API routes ────────────────────────────────────────────────────────────────
app.use("/api", router);

// ── Serve React frontend (production only) ────────────────────────────────────
// In development (Replit) the Vite dev server handles the frontend separately.
// On Render the frontend is built first and placed at the path below.
const frontendDist = path.join(process.cwd(), "../dak-transcription/dist/public");

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));

  // SPA catch-all — let React Router handle client-side navigation
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
  logger.info({ frontendDist }, "Serving frontend static files");
}

export default app;
