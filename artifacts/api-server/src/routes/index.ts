import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import jobsRouter from "./jobs";
import walletRouter from "./wallet";
import dashboardRouter from "./dashboard";
import teamRouter from "./team";
import supportRouter from "./support";
import uploadsRouter from "./uploads";
import paymentsRouter from "./payments";
import { requireAuth } from "../middleware/requireAuth";

const router: IRouter = Router();

// Public routes
router.use(healthRouter);
router.use(authRouter);

// Protected routes — require valid JWT cookie
router.use(requireAuth);
router.use(uploadsRouter);
router.use(jobsRouter);
router.use(walletRouter);
router.use(dashboardRouter);
router.use(teamRouter);
router.use(supportRouter);
router.use(paymentsRouter);

export default router;
