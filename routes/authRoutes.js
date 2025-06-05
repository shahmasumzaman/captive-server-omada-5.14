// routes/authRoutes.js
import { Router } from "express";
import { handleOmadaUsernameLogin, handleArubaLogin } from "../controllers/authController.js";

const router = Router();

// Route for Omada specific RADIUS login
router.post("/omada/username-login", handleOmadaUsernameLogin);

// Placeholder for Aruba specific login
router.post("/aruba/username-login", handleArubaLogin);

// You can add a generic /login route that determines the controller based on parameters
// router.post("/login", determineControllerAndAuthenticate);

export default router;