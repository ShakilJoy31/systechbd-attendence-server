const express = require("express");
const verifyJWT = require("../middleware/verifyJWT");
const { addAudience, getAllAudienceForClient, getAudienceStatsForClient, updateAudience, deleteAudience, getAudienceById, addPhoneNumbersToAudience, removePhoneNumbersFromAudience, sendSMSToAudience, sendSMSToAllAudience } = require("../controller/sms-configurations/audience.controller");
const router = express.Router();

// Client-specific Audience routes
router.post("/:clientId/create", verifyJWT, addAudience);
router.get("/:clientId/all", verifyJWT, getAllAudienceForClient);
router.get("/:clientId/stats", verifyJWT, getAudienceStatsForClient);
router.put("/:clientId/update/:id", verifyJWT, updateAudience);
router.delete("/:clientId/delete/:id", verifyJWT, deleteAudience);
router.get("/:clientId/get/:id", verifyJWT, getAudienceById);

// Phone number management routes
router.post("/:clientId/:id/add-numbers", verifyJWT, addPhoneNumbersToAudience);
router.post("/:clientId/:id/remove-numbers", verifyJWT, removePhoneNumbersFromAudience);

// SMS sending routes
router.post("/:clientId/:id/send-sms", verifyJWT, sendSMSToAudience);
router.post("/:clientId/:id/send-all", verifyJWT, sendSMSToAllAudience);

module.exports = router;