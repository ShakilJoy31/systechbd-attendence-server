const { Op } = require("sequelize");
const ClientInformation = require("../../models/Authentication/client.model");
const sequelize = require("../../database/connection");
const { generateAccessToken, generateRefreshToken } = require("../../middleware/jwtHelper");

//! Helper function to get package details
const getPackageDetails = async (packageId) => {
  try {
    const package = await Package.findOne({
      where: { id: packageId },
      attributes: [
        "id",
        "packageName",
        "packageBandwidth",
        "packagePrice",
        "packageDetails",
        "duration",
        "status",
      ],
    });
    return package ? package.toJSON() : null;
  } catch (error) {
    console.error("Error fetching package details:", error);
    return null;
  }
};

//! Helper function to transform client with package details
const transformClientWithPackage = async (client) => {
  const clientData = client.toJSON ? client.toJSON() : client;

  // Get package details if package exists
  if (clientData.package) {
    const packageDetails = await getPackageDetails(clientData.package);
    if (packageDetails) {
      clientData.package = packageDetails.packageName; // Replace ID with name
      clientData.packageId = clientData.package; // Store original ID
      clientData.packageDetails = packageDetails; // Add full package details
    }
  }

  return clientData;
};

//! Create new client
const createClient = async (req, res, next) => {
  try {
    const {
      fullName,
      photo,
      dateOfBirth,
      age,
      sex,
      nidOrPassportNo,
      nidPhotoFrontSide,
      nidPhotoBackSide,
      mobileNo,
      email,
      password,
      status = "pending",
      role = "client",
    } = req.body;

    // Validate required fields 
    if (!fullName || !mobileNo || !email) {
      return res.status(400).json({
        success: false,
        message: "Full name, mobile number, and email are required!",
      });
    }

    // Check if email already exists
    const emailExists = await ClientInformation.findOne({ where: { email } });
    if (emailExists) {
      return res.status(409).json({
        success: false,
        message: "This email already exists!",
      });
    }

    // Check if mobile already exists
    const mobileExists = await ClientInformation.findOne({ where: { mobileNo } });
    if (mobileExists) {
      return res.status(409).json({
        success: false,
        message: "This mobile number already exists!",
      });
    }

    // Check if NID already exists (if provided)
    if (nidOrPassportNo) {
      const nidExists = await ClientInformation.findOne({ where: { nidOrPassportNo } });
      if (nidExists) {
        return res.status(409).json({
          success: false,
          message: "This NID/Passport number already exists!",
        });
      }
    }

    // Create new client
    const newClient = await ClientInformation.create({
      fullName,
      photo: photo || null,
      dateOfBirth: dateOfBirth || null,
      age: age ? parseInt(age) : null,
      sex: sex || null,
      nidOrPassportNo: nidOrPassportNo || null,
      nidPhotoFrontSide: nidPhotoFrontSide || "",
      nidPhotoBackSide: nidPhotoBackSide || "",
      mobileNo,
      email,
      role,
      status,
      password: password || mobileNo, // Default password to mobile number if not provided
    });

    // Transform response
    const clientData = await transformClientWithPackage(newClient);

    // Generate tokens even for pending users (but they can't login until active)
    const userForToken = {
      id: newClient.id,
      email: newClient.email,
      role: newClient.role,
      status: newClient.status,
      fullName: newClient.fullName
    };
    
    const accessToken = generateAccessToken(userForToken);
    const refreshToken = generateRefreshToken(userForToken);

    // Add nidPhoto object to response
    const responseData = {
      ...clientData,
      nidPhoto: {
        frontSide: newClient.nidPhotoFrontSide || "",
        backSide: newClient.nidPhotoBackSide || ""
      },
      tokens: {
        accessToken,
        refreshToken
      },
      accountInfo: {
        id: newClient.id,
        fullName: newClient.fullName,
        email: newClient.email,
        status: newClient.status,
        role: newClient.role,
        message: newClient.status === 'pending' 
          ? "Account created successfully but is pending for approval"
          : "Account created successfully"
      }
    };

    return res.status(201).json({
      success: true,
      message: newClient.status === 'pending' 
        ? "Registration successful! Your account is pending approval." 
        : "Client created successfully!",
      data: responseData,
    });
  } catch (error) {
    console.error("Error creating client:", error);
    next(error);
  }
};

//! Get all clients with pagination and filtering
const getAllClients = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "",
      role = "", // Change default to empty string
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const whereClause = {}; // Start with empty object

    // Only add role to whereClause if it's provided
    if (role) {
      whereClause.role = role;
    }

    // Add search functionality
    if (search) {
      whereClause[Op.or] = [
        { fullName: { [Op.like]: `%${search}%` } },
      ];
    }

    // Add status filter
    if (status) {
      whereClause.status = status;
    }

    const { count, rows: clients } = await ClientInformation.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset: offset,
      order: [["createdAt", "DESC"]],
      attributes: { exclude: ["password"] },
    });

    // Transform each client with package details
    const transformedClients = await Promise.all(
      clients.map((client) => transformClientWithPackage(client))
    );

    // Add nidPhoto to transformed clients
    const clientsWithNidPhotos = transformedClients.map(client => ({
      ...client,
      nidPhoto: {
        frontSide: client.nidPhotoFrontSide || "",
        backSide: client.nidPhotoBackSide || ""
      }
    }));

    const totalPages = Math.ceil(count / limitNumber);

    return res.status(200).json({
      message: "Clients retrieved successfully!",
      data: clientsWithNidPhotos,
      pagination: {
        totalItems: count,
        totalPages: totalPages,
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting all clients:", error);
    next(error);
  }
};

//! Get client by ID
const getClientById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = await ClientInformation.findOne({
      where: { id },
      attributes: { exclude: ["password"] },
    });

    if (!client) {
      return res.status(404).json({
        message: "Client not found!",
      });
    }

    // Transform response
    const clientData = await transformClientWithPackage(client);

    // Add nidPhoto object to response
    const responseData = {
      ...clientData,
      nidPhoto: {
        frontSide: client.nidPhotoFrontSide || "",
        backSide: client.nidPhotoBackSide || ""
      }
    };

    return res.status(200).json({
      message: "Client retrieved successfully!",
      data: responseData,
    });
  } catch (error) {
    console.error("Error getting client by ID:", error);
    next(error);
  }
};

//! Get pending client for account activation. 
const getPendingClientForAccountActivation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = await ClientInformation.findOne({
      where: { id },
      attributes: { exclude: ["password"] },
    });

    if (!client) {
      return res.status(404).json({
        message: "Client not found!",
      });
    }

    // Transform response
    const clientData = await transformClientWithPackage(client);

    // Add nidPhoto object to response
    const responseData = {
      ...clientData,
      nidPhoto: {
        frontSide: client.nidPhotoFrontSide || "",
        backSide: client.nidPhotoBackSide || ""
      }
    };

    return res.status(200).json({
      message: "Client retrieved successfully!",
      data: responseData,
    });
  } catch (error) {
    console.error("Error getting client by ID:", error);
    next(error);
  }
}

//! Update client
const updateClient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      fullName,
      photo,
      dateOfBirth,
      age,
      sex,
      nidOrPassportNo,
      nidPhotoFrontSide,
      nidPhotoBackSide,
      mobileNo,
      email,
      password,
      status,
      role,
    } = req.body;

    // Check if client exists
    const existingClient = await ClientInformation.findOne({ where: { id } });
    if (!existingClient) {
      return res.status(404).json({
        message: "Client not found!",
      });
    }

    // Check if new email already exists (if changed)
    if (email && email !== existingClient.email) {
      const emailExists = await ClientInformation.findOne({ where: { email } });
      if (emailExists) {
        return res.status(409).json({
          message: "This email already exists!",
        });
      }
    }

    // Check if new mobile already exists (if changed)
    if (mobileNo && mobileNo !== existingClient.mobileNo) {
      const mobileExists = await ClientInformation.findOne({
        where: { mobileNo },
      });
      if (mobileExists) {
        return res.status(409).json({
          message: "This mobile number already exists!",
        });
      }
    }

    // Check if new NID already exists (if changed)
    if (nidOrPassportNo && nidOrPassportNo !== existingClient.nidOrPassportNo) {
      const nidExists = await ClientInformation.findOne({
        where: { nidOrPassportNo },
      });
      if (nidExists) {
        return res.status(409).json({
          message: "This NID/Passport number already exists!",
        });
      }
    }

    // Prepare update data
    const updateData = {
      fullName: fullName !== undefined ? fullName : existingClient.fullName,
      photo: photo !== undefined ? photo : existingClient.photo,
      dateOfBirth: dateOfBirth !== undefined ? dateOfBirth : existingClient.dateOfBirth,
      age: age !== undefined ? parseInt(age) : existingClient.age,
      sex: sex !== undefined ? sex : existingClient.sex,
      nidOrPassportNo: nidOrPassportNo !== undefined ? nidOrPassportNo : existingClient.nidOrPassportNo,
      nidPhotoFrontSide: nidPhotoFrontSide !== undefined ? nidPhotoFrontSide : existingClient.nidPhotoFrontSide,
      nidPhotoBackSide: nidPhotoBackSide !== undefined ? nidPhotoBackSide : existingClient.nidPhotoBackSide,
      mobileNo: mobileNo !== undefined ? mobileNo : existingClient.mobileNo,
      email: email !== undefined ? email : existingClient.email,
      status: status !== undefined ? status : existingClient.status,
      role: role !== undefined ? role : existingClient.role,
    };

    // Update password if provided
    if (password) {
      updateData.password = password;
    }

    // Perform update
    await ClientInformation.update(updateData, {
      where: { id },
    });

    // Fetch updated client
    const updatedClient = await ClientInformation.findOne({
      where: { id },
      attributes: { exclude: ["password"] },
    });

    // Transform response
    const clientData = await transformClientWithPackage(updatedClient);

    // Add nidPhoto object to response
    const responseData = {
      ...clientData,
      nidPhoto: {
        frontSide: updatedClient.nidPhotoFrontSide || "",
        backSide: updatedClient.nidPhotoBackSide || ""
      }
    };

    return res.status(200).json({
      message: "Client updated successfully!",
      data: responseData,
    });
  } catch (error) {
    console.error("Error updating client:", error);
    next(error);
  }
};

//! Delete client
const deleteClient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existingClient = await ClientInformation.findOne({ where: { id } });

    if (!existingClient) {
      return res.status(404).json({
        message: "Client not found!",
      });
    }

    await ClientInformation.destroy({ where: { id } });

    return res.status(200).json({
      message: "Client deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting client:", error);
    next(error);
  }
};

//! Update client status (approve/reject)
const updateClientStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const client = await ClientInformation.findOne({ where: { id } });
    if (!client) {
      return res.status(404).json({
        message: "Client not found!",
      });
    }

    await ClientInformation.update({ status }, { where: { id } });

    // Fetch updated client
    const updatedClient = await ClientInformation.findOne({
      where: { id },
      attributes: { exclude: ["password"] },
    });

    // Transform response
    const clientData = await transformClientWithPackage(updatedClient);

    // Add nidPhoto object to response
    const responseData = {
      ...clientData,
      nidPhoto: {
        frontSide: updatedClient.nidPhotoFrontSide || "",
        backSide: updatedClient.nidPhotoBackSide || ""
      }
    };

    return res.status(200).json({
      message: `Client ${status} successfully!`,
      data: responseData,
    });
  } catch (error) {
    console.error("Error updating client status:", error);
    next(error);
  }
};

//! Get client statistics
const getClientStats = async (req, res, next) => {
  try {
    const totalClients = await ClientInformation.count();
    const activeClients = await ClientInformation.count({
      where: { status: "active" },
    });
    const pendingClients = await ClientInformation.count({
      where: { status: "pending" },
    });
    const inactiveClients = await ClientInformation.count({
      where: { status: "inactive" },
    });

    // Count by role
    const roles = await ClientInformation.findAll({
      attributes: [
        "role",
        [sequelize.fn("COUNT", sequelize.col("role")), "count"],
      ],
      group: ["role"],
    });

    return res.status(200).json({
      message: "Client statistics retrieved successfully!",
      data: {
        totalClients,
        activeClients,
        pendingClients,
        inactiveClients,
        roles,
      },
    });
  } catch (error) {
    console.error("Error getting client stats:", error);
    next(error);
  }
};

//! Check user credentials (login)
const checkUserCredentials = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Both email and password are required.",
      });
    }

    // Find the user by email in ClientInformation table
    let user = await ClientInformation.findOne({
      where: { email },
    });

    // If user is not found
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Check if the password matches
    if (user.password !== password) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Check user status - Only allow login if status is 'active'
    if (user.status.toLowerCase() !== "active") {
      let statusMessage = "";

      if (user.status.toLowerCase() === "pending") {
        statusMessage =
          "Your account is pending approval. You will be able to login once your account is approved by admin.";
      } else if (user.status.toLowerCase() === "inactive") {
        statusMessage =
          "Your account is currently inactive. Please contact support to reactivate your account.";
      } else {
        statusMessage = `Your account status is "${user.status}". Please contact support for assistance.`;
      }

      return res.status(403).json({
        success: false,
        message: statusMessage,
        accountInfo: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          status: user.status,
          role: user.role,
        },
      });
    }

    // Remove password from response
    const userResponse = user.toJSON();
    delete userResponse.password;

    // Add nidPhoto object to response
    userResponse.nidPhoto = {
      frontSide: user.nidPhotoFrontSide || "",
      backSide: user.nidPhotoBackSide || ""
    };

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // You might want to store refreshToken in database for the user
    // For now, we'll just return it in the response

    return res.status(200).json({
      success: true,
      message: "Login successful!",
      data: {
        ...userResponse,
        tokens: {
          accessToken,
          refreshToken
        }
      },
    });
  } catch (error) {
    console.error("Error checking user credentials:", error);
    next(error);
  }
};

//! Change Password
const changePassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: "All password fields are required",
      });
    }

    // Check if new password and confirm password match
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirmation password do not match",
      });
    }

    // Check if new password is different from current password
    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    // Validate password strength (optional)
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long",
      });
    }

    // Find the user
    const user = await ClientInformation.findOne({
      where: { id },
      attributes: ['id', 'email', 'password', 'fullName', 'role']
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify current password
    if (user.password !== currentPassword) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Update the password
    await ClientInformation.update(
      { password: newPassword },
      { where: { id } }
    );

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      }
    });

  } catch (error) {
    console.error("Error changing password:", error);
    next(error);
  }
};

module.exports = {
  createClient,
  getAllClients,
  getClientById,
  updateClient,
  deleteClient,
  updateClientStatus,
  getClientStats,
  checkUserCredentials,
  changePassword,
  getPendingClientForAccountActivation
};