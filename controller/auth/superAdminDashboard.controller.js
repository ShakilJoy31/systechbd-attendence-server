const { Op, Sequelize } = require("sequelize");
const ClientInformation = require("../../models/Authentication/client.model");

//! Create Super-Admin User

const createSuperAdmin = async (req, res, next) => {
  try {
    const {
      fullName,
      fatherOrSpouseName,
      dateOfBirth,
      age,
      sex,
      maritalStatus,
      nidOrPassportNo,
      jobPlaceName,
      jobCategory,
      customerId,
      jobType,
      mobileNo,
      email,
      customerType,
      package,
      location,
      area,
      flatAptNo,
      houseNo,
      roadNo,
      landmark,
      connectionDetails,
      costForPackage,
      referId,
      photo,
      password,
      status,
      role,
      routerLoginId,
      routerLoginPassword,
    } = req.body;

    // Generate unique IDs
    const userId = await generateUniqueUserId(fullName);

    // Create new client
    const newClient = await ClientInformation.create({
      customerId,
      userId,
      fullName,
      photo: photo || null,
      fatherOrSpouseName,
      dateOfBirth: dateOfBirth || null,
      age: parseInt(age),
      sex,
      maritalStatus,
      nidOrPassportNo,
      jobPlaceName: jobPlaceName || null,
      jobCategory: jobCategory || null,
      jobType,
      mobileNo,
      email,
      customerType,
      package,
      location,
      area,
      flatAptNo,
      houseNo,
      roadNo,
      landmark,
      connectionDetails: connectionDetails || null,
      costForPackage,
      referId: referId || null,
      role: role,
      status: status,
      password: password || mobileNo,
      // New fields
      routerLoginId: routerLoginId || null,
      routerLoginPassword: routerLoginPassword || null,
    });

    // Transform response with package details
    const clientData = await transformClientWithPackage(newClient);

    return res.status(201).json({
      message: "Client created successfully!",
      data: clientData,
    });
  } catch (error) {
    next(error);
  }
};


module.exports = {
  createSuperAdmin
};