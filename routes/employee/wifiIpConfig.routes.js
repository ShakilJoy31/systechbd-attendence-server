const express = require("express");
const router = express.Router();
const verifyJWT = require("../../middleware/verifyJWT");
const { createIpConfig, getAllIpConfigs, getActiveIpConfigs, getIpConfigStats, getIpConfigById, updateIpConfig, toggleIpConfigStatus, deleteIpConfig, bulkImportIpConfigs, validateIp } = require("../../controller/employee/wifiIpConfig.controller");

//! Protected routes (authentication required for all)

// Create new IP configuration
router.post("/create", verifyJWT, createIpConfig);

// Get all IP configurations (with pagination and filtering)
router.get("/all", verifyJWT, getAllIpConfigs);

// Get active IP configurations (for attendance)
router.get("/active", verifyJWT, getActiveIpConfigs);

// Get IP configuration statistics
router.get("/stats", verifyJWT, getIpConfigStats);

// Get IP configuration by ID
router.get("/:id", verifyJWT, getIpConfigById);

// Update IP configuration
router.put("/update/:id", verifyJWT, updateIpConfig);

// Toggle IP configuration status
router.patch("/toggle-status/:id", verifyJWT, toggleIpConfigStatus);

// Delete IP configuration
router.delete("/delete/:id", verifyJWT, deleteIpConfig);

// Bulk import IP configurations
router.post("/bulk-import", verifyJWT, bulkImportIpConfigs);

// Validate IP address (public endpoint or protected as needed)
router.get("/validate/:ipAddress", validateIp);

module.exports = router;