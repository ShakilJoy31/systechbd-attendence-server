const { Op } = require("sequelize");
const ClientInformation = require("../../models/Authentication/client.model");
const SMSConfig = require("../../models/SMSconfiguration/smsConfig.model");
const sequelize = require("../../database/connection");

//! Create new SMS Configuration for a client
const createSMSConfig = async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { appName, apiKey, type, senderId, message, status } = req.body;

    // Validate required fields
    if (!appName || !apiKey || !senderId || !message) {
      return res.status(400).json({
        message: "App name, API key, sender ID, and message are required fields.",
      });
    }

    // Check if client exists
    const client = await ClientInformation.findByPk(clientId);
    if (!client) {
      return res.status(404).json({
        message: "Client not found!",
      });
    }

    // Validate API key format
    if (apiKey.length < 10) {
      return res.status(400).json({
        message: "API key must be at least 10 characters long.",
      });
    }

    // Validate type
    const validTypes = ["unicode", "text", "flash"];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({
        message: "Type must be either 'unicode', 'text', or 'flash'.",
      });
    }

    // Validate sender ID
    if (senderId.length < 3 || senderId.length > 20) {
      return res.status(400).json({
        message: "Sender ID must be between 3 and 20 characters.",
      });
    }

    // Validate message
    if (message.trim() === '') {
      return res.status(400).json({
        message: "Message cannot be empty.",
      });
    }

    // Check if the app name already exists for this client
    const existingSMS = await SMSConfig.findOne({ 
      where: { 
        clientId,
        appName 
      } 
    });
    
    if (existingSMS) {
      return res.status(409).json({
        message: "An SMS configuration with this app name already exists for this client!",
      });
    }

    // Create a new SMS configuration
    const newSMS = await SMSConfig.create({
      clientId,
      appName,
      apiKey,
      type: type || "unicode",
      senderId,
      message: message.trim(),
      status: status !== undefined ? status : true,
      baseUrl: "https://msg.mram.com.bd/smsapi"
    });

    // Return response
    const smsResponse = {
      id: newSMS.id,
      clientId: newSMS.clientId,
      appName: newSMS.appName,
      apiKey: newSMS.apiKey,
      type: newSMS.type,
      senderId: newSMS.senderId,
      message: newSMS.message,
      status: newSMS.status,
      baseUrl: newSMS.baseUrl,
      createdAt: newSMS.createdAt,
      updatedAt: newSMS.updatedAt
    };

    return res.status(201).json({
      message: "SMS configuration created successfully!",
      data: smsResponse,
    });
  } catch (error) {
    next(error);
  }
};

//! Get all SMS Configurations for a client with pagination and filters
const getAllSMSForClient = async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Check if client exists
    const client = await ClientInformation.findByPk(clientId, {
      attributes: ['id', 'fullName', 'email', 'mobileNo']
    });
    if (!client) {
      return res.status(404).json({
        message: "Client not found!",
      });
    }

    // Extract filters
    const { search, status, type } = req.query;
    let whereCondition = { clientId };

    // Add search filter
    if (search) {
      whereCondition = {
        ...whereCondition,
        [Op.or]: [
          { appName: { [Op.like]: `%${search}%` } },
          { senderId: { [Op.like]: `%${search}%` } },
          { message: { [Op.like]: `%${search}%` } },
        ],
      };
    }

    // Add status filter
    if (status !== undefined) {
      whereCondition.status = status === 'true' || status === '1';
    }

    // Add type filter
    if (type) {
      whereCondition.type = type;
    }

    // Fetch paginated SMS configurations
    const { count, rows: smsConfigs } = await SMSConfig.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    // Add client info to each SMS config manually
    const smsConfigsWithClient = smsConfigs.map(sms => {
      return {
        ...sms.toJSON(),
        client: client // Manually add client information
      };
    });

    const totalPages = Math.ceil(count / limit);

    return res.status(200).json({
      message: "SMS configurations retrieved successfully!",
      data: smsConfigsWithClient,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalItems: count,
        itemsPerPage: limit
      },
    });
  } catch (error) {
    next(error);
  }
};

//! Update SMS Configuration
const updateSMSConfig = async (req, res, next) => {
  try {
    const { clientId, id } = req.params;
    const { appName, apiKey, type, senderId, message, status } = req.body;

    // Find the SMS configuration
    const smsToUpdate = await SMSConfig.findOne({ 
      where: { 
        id,
        clientId 
      }
    });

    if (!smsToUpdate) {
      return res.status(404).json({
        message: "SMS configuration not found!",
      });
    }

    // Validate type if provided
    if (type) {
      const validTypes = ["unicode", "text", "flash"];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          message: "Type must be either 'unicode', 'text', or 'flash'.",
        });
      }
    }

    // Validate message if provided
    if (message !== undefined) {
      if (message.trim() === '') {
        return res.status(400).json({
          message: "Message cannot be empty.",
        });
      }
    }

    // Check for duplicate app name (if changing)
    if (appName && appName !== smsToUpdate.appName) {
      const existingSMS = await SMSConfig.findOne({
        where: {
          clientId,
          appName,
          id: { [Op.ne]: id }
        }
      });
      
      if (existingSMS) {
        return res.status(409).json({
          message: "An SMS configuration with this app name already exists!",
        });
      }
    }

    // Update the SMS configuration fields
    if (appName) smsToUpdate.appName = appName;
    if (apiKey) smsToUpdate.apiKey = apiKey;
    if (type) smsToUpdate.type = type;
    if (senderId) smsToUpdate.senderId = senderId;
    if (message !== undefined) smsToUpdate.message = message.trim();
    if (status !== undefined) smsToUpdate.status = status;

    // Save the updated SMS configuration
    await smsToUpdate.save();

    // Return response
    const updatedResponse = {
      id: smsToUpdate.id,
      clientId: smsToUpdate.clientId,
      appName: smsToUpdate.appName,
      apiKey: smsToUpdate.apiKey,
      type: smsToUpdate.type,
      senderId: smsToUpdate.senderId,
      message: smsToUpdate.message,
      status: smsToUpdate.status,
      baseUrl: smsToUpdate.baseUrl,
      createdAt: smsToUpdate.createdAt,
      updatedAt: smsToUpdate.updatedAt
    };

    return res.status(200).json({
      message: "SMS configuration updated successfully!",
      data: updatedResponse,
    });
  } catch (error) {
    next(error);
  }
};

//! Delete SMS Configuration
const deleteSMSConfig = async (req, res, next) => {
  try {
    const { clientId, id } = req.params;

    // Find the SMS configuration
    const smsToDelete = await SMSConfig.findOne({ 
      where: { 
        id,
        clientId 
      }
    });

    if (!smsToDelete) {
      return res.status(404).json({
        message: "SMS configuration not found!",
      });
    }
    
    // Delete the SMS configuration
    await smsToDelete.destroy();

    return res.status(200).json({
      message: "SMS configuration deleted successfully!",
    });
  } catch (error) {
    next(error);
  }
};

//! Get SMS Configuration by ID
const getSMSConfigById = async (req, res, next) => {
  try {
    const { clientId, id } = req.params;

    // Find the SMS configuration
    const sms = await SMSConfig.findOne({ 
      where: { 
        id,
        clientId 
      }
    });

    if (!sms) {
      return res.status(404).json({
        message: "SMS configuration not found!",
      });
    }

    // Get client information separately
    const client = await ClientInformation.findByPk(clientId, {
      attributes: ['id', 'fullName', 'email', 'mobileNo', 'photo']
    });

    // Combine SMS config with client info
    const smsWithClient = {
      ...sms.toJSON(),
      client: client || null
    };

    return res.status(200).json({
      message: "SMS configuration retrieved successfully!",
      data: smsWithClient,
    });
  } catch (error) {
    next(error);
  }
};

//! Test SMS Configuration
const testSMSConfig = async (req, res, next) => {
  try {
    const { clientId, id } = req.params;
    const { phoneNumber, customMessage } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        message: "Phone number is required for testing.",
      });
    }

    // Find the SMS configuration
    const sms = await SMSConfig.findOne({ 
      where: { 
        id,
        clientId 
      }
    });

    if (!sms) {
      return res.status(404).json({
        message: "SMS configuration not found!",
      });
    }

    // Use custom message if provided, otherwise use saved message
    const messageToSend = customMessage || sms.message;
    
    // Construct the test URL
    const testUrl = `${sms.baseUrl}?api_key=${sms.apiKey}&type=${sms.type}&contacts=${phoneNumber}&senderid=${sms.senderId}&msg=${encodeURIComponent(messageToSend)}`;

    // Simulate API call
    const isSuccess = Math.random() > 0.3; // 70% success rate for simulation

    if (isSuccess) {
      return res.status(200).json({
        message: "Test SMS sent successfully!",
        data: {
          testUrl: testUrl,
          status: "success",
          simulated: true,
          details: {
            to: phoneNumber,
            messageLength: messageToSend.length,
            type: sms.type,
            senderId: sms.senderId,
          }
        },
      });
    } else {
      return res.status(500).json({
        message: "Failed to send test SMS. Please check your configuration.",
        data: {
          testUrl: testUrl,
          status: "failed",
          simulated: true
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

//! Get SMS Statistics for a client
const getSMSStatsForClient = async (req, res, next) => {
  try {
    const { clientId } = req.params;

    // Check if client exists
    const client = await ClientInformation.findByPk(clientId);
    if (!client) {
      return res.status(404).json({
        message: "Client not found!",
      });
    }

    // Get total SMS configurations
    const totalSMS = await SMSConfig.count({
      where: { clientId }
    });

    // Get active SMS configurations
    const activeSMS = await SMSConfig.count({
      where: { 
        clientId,
        status: true 
      }
    });

    // Get inactive SMS configurations
    const inactiveSMS = await SMSConfig.count({
      where: { 
        clientId,
        status: false 
      }
    });

    // Get SMS count by service using raw query instead of Sequelize association
    const [smsByService] = await sequelize.query(
      `SELECT service, COUNT(id) as count FROM sms_configs WHERE clientId = ? GROUP BY service`,
      {
        replacements: [clientId],
        type: sequelize.QueryTypes.SELECT
      }
    );

    // Format byService data
    const byService = {};
    if (smsByService && Array.isArray(smsByService)) {
      smsByService.forEach(item => {
        byService[item.service] = parseInt(item.count);
      });
    }

    return res.status(200).json({
      message: "SMS statistics retrieved successfully!",
      data: {
        clientId,
        totalSMS,
        activeSMS,
        inactiveSMS,
        byService
      }
    });
  } catch (error) {
    next(error);
  }
};

//! Toggle SMS Configuration Status
const toggleSMSStatus = async (req, res, next) => {
  try {
    const { clientId, id } = req.params;

    // Find the SMS configuration
    const sms = await SMSConfig.findOne({ 
      where: { 
        id,
        clientId 
      }
    });

    if (!sms) {
      return res.status(404).json({
        message: "SMS configuration not found!",
      });
    }

    // Toggle status
    sms.status = !sms.status;
    await sms.save();

    return res.status(200).json({
      message: `SMS configuration ${sms.status ? 'activated' : 'deactivated'} successfully!`,
      data: {
        id: sms.id,
        status: sms.status
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSMSConfig,
  getAllSMSForClient,
  updateSMSConfig,
  deleteSMSConfig,
  getSMSConfigById,
  testSMSConfig,
  getSMSStatsForClient,
  toggleSMSStatus
};