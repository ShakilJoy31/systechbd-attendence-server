const express = require("express");
const { createSMSConfig, getAllSMSForClient, getSMSStatsForClient, updateSMSConfig, deleteSMSConfig, getSMSConfigById, testSMSConfig, toggleSMSStatus } = require("../controller/sms-configurations/smsConfig.controller");
const verifyJWT = require("../middleware/verifyJWT");
const router = express.Router();

// Client-specific SMS routes
router.post("/:clientId/create", verifyJWT, createSMSConfig);
router.get("/:clientId/all", verifyJWT, getAllSMSForClient);
router.get("/:clientId/stats", verifyJWT, getSMSStatsForClient);
router.put("/:clientId/update/:id",verifyJWT, updateSMSConfig);
router.delete("/:clientId/delete/:id",verifyJWT, deleteSMSConfig);
router.get("/:clientId/get/:id",verifyJWT, getSMSConfigById);
router.post("/:clientId/test/:id",verifyJWT, testSMSConfig);
router.patch("/:clientId/toggle-status/:id", verifyJWT, toggleSMSStatus);

module.exports = router;