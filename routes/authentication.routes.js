const express = require("express");
const { createClient, checkUserCredentials, getAllClients, updateClient, deleteClient, getClientById, changePassword, getPendingClientForAccountActivation } = require("../controller/auth/signup");
const verifyJWT = require("../middleware/verifyJWT");
const router = express.Router();



//! Client routes
router.post("/register-new-client", createClient);
router.put("/update-client/:id", verifyJWT, updateClient);
router.delete("/delete-client/:id", verifyJWT, deleteClient);
router.get("/get-clients", verifyJWT, getAllClients);
router.get("/get-client-according-to-id/:id", verifyJWT, getClientById);
router.put("/change-password/:id", verifyJWT, changePassword);
//! User will be able to get the data without
router.get("/get-pending-client-for-account-activation/:id", getPendingClientForAccountActivation)




router.post("/login", checkUserCredentials);


module.exports = authenticationRoutes = router;