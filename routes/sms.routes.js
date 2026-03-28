const express = require("express");
const verifyJWT = require("../middleware/verifyJWT");
const { SendSms, getSMSHistory } = require("../controller/sms-configurations/sms.controller");
// const { getSMSHistory } = require("../utils/helper/smsHistoryHelper");
const router = express.Router();

// Route for sending SMS to audience
router.post("/:clientId/send", verifyJWT, SendSms);


router.get("/history", verifyJWT, getSMSHistory);

module.exports = router;
