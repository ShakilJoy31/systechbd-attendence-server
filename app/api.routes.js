const authenticationRoutes = require("../routes/brotherEnterprise.routes");
const smsConfigurationRoutes = require("../routes/smsConfiguration.routes");
const supplierRoutes = require("../routes/supplier/supplier.routes");
const audienceConfigurations = require("../routes/audience.routes");
const smsSendingRoutes = require("../routes/sms.routes");
const paymentRoutes = require("../routes/payment.routes");
const employeeRoutes = require("../routes/employee/employee.routes");
const attendanceRoutes = require("../routes/attendance/attendance.routes");
const wifiIpConfigRoutes = require("../routes/employee/wifiIpConfig.routes");

const uploadWithMulter = require("../middleware/uploadWithMulter");


const router = require("express").Router();

router.use("/authentication", authenticationRoutes);

router.use("/employees", employeeRoutes);

router.use("/wifi-ip-config", wifiIpConfigRoutes);

router.use("/sms-configurations", smsConfigurationRoutes);

router.use("/suppliers", supplierRoutes);

// Add this route
router.use("/attendance", attendanceRoutes);




//! May not needed.
router.use("/audience-configuration", audienceConfigurations);
router.use("/sms", smsSendingRoutes);
router.use("/payment", paymentRoutes);





// File upload route - FIXED to match frontend URL
router.post("/file/upload", uploadWithMulter.single("image"), (req, res) => {
  try {
    if (!req.filelink) {
      return res.status(400).json({ 
        success: false,
        message: "File upload failed" 
      });
    }

    res.json({ 
      success: true,
      data: [req.filelink]
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Upload failed"
    });
  }
});

module.exports = router;