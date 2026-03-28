// routes/employee/employee.routes.js
const express = require("express");
const router = express.Router();
const {
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  updateEmployeeStatus,
  bulkImportEmployees,
  getEmployeeStats,
  searchEmployees,
} = require("../../controller/employee/employee.controller");
const verifyJWT = require("../../middleware/verifyJWT");

//! Public routes (no authentication required - if needed for public endpoints)
// None for employees as it's internal management

//! Protected routes (authentication required)
router.post("/create-employee", verifyJWT, createEmployee);
router.get("/get-employees", verifyJWT, getAllEmployees);
router.get("/get-employee/:id", getEmployeeById);
router.put("/update-employee/:id", verifyJWT, updateEmployee);
router.delete("/delete-employee/:id", verifyJWT, deleteEmployee);
router.put("/update-employee-status/:id", verifyJWT, updateEmployeeStatus);
router.post("/bulk-import-employees", verifyJWT, bulkImportEmployees);
router.get("/stats", verifyJWT, getEmployeeStats);
router.get("/search", verifyJWT, searchEmployees);

module.exports = router;