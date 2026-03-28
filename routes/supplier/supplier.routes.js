const express = require("express");
const { searchSuppliers, getSupplierStats, createSupplier, getAllSuppliers, getSupplierById, updateSupplier, deleteSupplier, updateSupplierStatus, updateSupplierRating, bulkImportSuppliers } = require("../../controller/supplier/supplier.controller");
const verifyJWT = require("../../middleware/verifyJWT");
const router = express.Router();


//! Public routes (no authentication required)
// Note: Usually all supplier routes should be protected, but if you need any public endpoints

//! Protected routes (authentication required)
router.use(verifyJWT); 


//! Search suppliers (for dropdown/autocomplete)
router.get("/search", searchSuppliers);

//! Get supplier statistics
router.get("/stats", getSupplierStats);

// CRUD operations
router.post("/create-supplier", createSupplier);
router.get("/get-suppliers", getAllSuppliers);
router.get("/get-supplier/:id", getSupplierById);
router.put("/update-supplier/:id", updateSupplier);
router.delete("/delete-supplier/:id", deleteSupplier);

// Status and rating management
router.put("/update-supplier-status/:id", updateSupplierStatus);
router.put("/update-supplier-rating/:id", updateSupplierRating);

// Bulk operations
router.post("/bulk-import-suppliers", bulkImportSuppliers);

module.exports = router;