// routes/attendance/attendance.routes.js
const express = require("express");
const router = express.Router();
const verifyJWT = require("../../middleware/verifyJWT");
const { selfCheckIn, selfCheckOut, getMyTodayAttendance, markAttendance, updateAttendance, getDailyAttendanceReport, getMonthlyAttendanceReport, getAttendanceByDateRange, getEmployeeAttendanceSummary } = require("../../controller/attendence/attendance.controller");


//! Employee self attendance routes (for logged-in employees)
router.post("/self/check-in", verifyJWT, selfCheckIn);
router.post("/self/check-out", verifyJWT, selfCheckOut);
router.get("/self/today", verifyJWT, getMyTodayAttendance);

//! Admin attendance management routes
router.post("/mark", verifyJWT, markAttendance);
router.put("/update/:id", verifyJWT, updateAttendance);

//! Attendance report routes (accessible by admin)
router.get("/reports/daily", verifyJWT, getDailyAttendanceReport);
router.get("/reports/monthly", verifyJWT, getMonthlyAttendanceReport);
router.get("/reports/range", verifyJWT, getAttendanceByDateRange);
router.get("/reports/summary", verifyJWT, getEmployeeAttendanceSummary);


module.exports = router;