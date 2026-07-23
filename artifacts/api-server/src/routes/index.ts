import { Router, type IRouter } from "express";
import healthRouter from "./health";
import jobsRouter from "./jobs";
import walletRouter from "./wallet";
import dashboardRouter from "./dashboard";
import teamRouter from "./team";

const router: IRouter = Router();

router.use(healthRouter);
router.use(jobsRouter);
router.use(walletRouter);
router.use(dashboardRouter);
router.use(teamRouter);

export default router;
