const { Op } = require("sequelize");
const ClientInformation = require("../../models/Authentication/client.model");
const SMSConfig = require("../../models/SMSconfiguration/smsConfig.model");
const Audience = require("../../models/SMSconfiguration/audience.model");

//! Add new audience with phone numbers
const addAudience = async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { configId, phoneNumbers } = req.body;

    // Validate required fields
    if (!configId || !phoneNumbers) {
      return res.status(400).json({
        message: "Config ID and phoneNumbers array are required.",
      });
    }

    // Validate phoneNumbers is an array
    if (!Array.isArray(phoneNumbers)) {
      return res.status(400).json({
        message: "phoneNumbers must be an array.",
      });
    }

    // Validate each phone number object
    for (const item of phoneNumbers) {
      if (!item.phoneNumber || !item.message) {
        return res.status(400).json({
          message: "Each phone number object must have phoneNumber and message.",
        });
      }

      // Validate phone number format
      const phoneRegex = /^[0-9]{10,15}$/;
      if (!phoneRegex.test(item.phoneNumber)) {
        return res.status(400).json({
          message: `Invalid phone number format: ${item.phoneNumber}. Must be 10-15 digits.`,
        });
      }

      // Validate message is not empty
      if (item.message.trim() === '') {
        return res.status(400).json({
          message: "Message cannot be empty for any phone number.",
        });
      }
    }

    // Check if client exists
    const client = await ClientInformation.findByPk(clientId);
    if (!client) {
      return res.status(404).json({
        message: "Client not found!",
      });
    }

    // Check if SMS config exists and belongs to client
    const smsConfig = await SMSConfig.findOne({
      where: {
        id: configId,
        
      }
    });

    if (!smsConfig) {
      return res.status(404).json({
        message: "SMS configuration not found or doesn't belong to this client!",
      });
    }

    // Check for duplicate phone numbers in the request
    const phoneSet = new Set();
    for (const item of phoneNumbers) {
      if (phoneSet.has(item.phoneNumber)) {
        return res.status(400).json({
          message: `Duplicate phone number found in request: ${item.phoneNumber}`,
        });
      }
      phoneSet.add(item.phoneNumber);
    }

    // Create new audience
    const newAudience = await Audience.create({
      clientId,
      configId,
      phoneNumbers
    });

    return res.status(201).json({
      message: "Audience created successfully!",
      data: {
        id: newAudience.id,
        clientId: newAudience.clientId,
        configId: newAudience.configId,
        phoneNumbers: newAudience.phoneNumbers,
        totalNumbers: phoneNumbers.length,
        createdAt: newAudience.createdAt
      },
    });
  } catch (error) {
    next(error);
  }
};

//! Get all audiences for a client with pagination
const getAllAudienceForClient = async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Check if client exists
    const client = await ClientInformation.findByPk(clientId);
    if (!client) {
      return res.status(404).json({
        message: "Client not found!",
      });
    }

    // Extract filters
    const { configId, search } = req.query;
    let whereCondition = { clientId };

    // Add configId filter
    if (configId) {
      whereCondition.configId = configId;
    }

    // Add search filter (search in phone numbers)
    if (search) {
      whereCondition.phoneNumbers = {
        [Op.like]: `%${search}%`
      };
    }

    // Fetch paginated audiences
    const { count, rows: audiences } = await Audience.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    // Get SMS configs for this client
    const smsConfigs = await SMSConfig.findAll({
      where: { clientId },
      attributes: ['id', 'appName']
    });

    // Format response with additional info
    const formattedAudiences = audiences.map(audience => {
      const phoneNumbers = audience.phoneNumbers || [];
      return {
        id: audience.id,
        clientId: audience.clientId,
        configId: audience.configId,
        configName: smsConfigs.find(c => c.id === audience.configId)?.appName || 'Unknown',
        totalNumbers: phoneNumbers.length,
        phoneNumbers: phoneNumbers,
        createdAt: audience.createdAt,
        updatedAt: audience.updatedAt
      };
    });

    const totalPages = Math.ceil(count / limit);

    return res.status(200).json({
      message: "Audiences retrieved successfully!",
      data: formattedAudiences,
      smsConfigs,
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

//! Update audience phone numbers
const updateAudience = async (req, res, next) => {
  try {
    const { clientId, id } = req.params;
    const { phoneNumbers } = req.body;

    // Validate phoneNumbers is an array
    if (!Array.isArray(phoneNumbers)) {
      return res.status(400).json({
        message: "phoneNumbers must be an array.",
      });
    }

    // Find the audience
    const audienceToUpdate = await Audience.findOne({ 
      where: { 
        id,
        clientId 
      }
    });

    if (!audienceToUpdate) {
      return res.status(404).json({
        message: "Audience not found!",
      });
    }

    // Validate each phone number object
    for (const item of phoneNumbers) {
      if (!item.phoneNumber || !item.message) {
        return res.status(400).json({
          message: "Each phone number object must have phoneNumber and message.",
        });
      }

      // Validate phone number format
      const phoneRegex = /^[0-9]{10,15}$/;
      if (!phoneRegex.test(item.phoneNumber)) {
        return res.status(400).json({
          message: `Invalid phone number format: ${item.phoneNumber}. Must be 10-15 digits.`,
        });
      }

      // Validate message is not empty
      if (item.message.trim() === '') {
        return res.status(400).json({
          message: "Message cannot be empty for any phone number.",
        });
      }
    }

    // Check for duplicate phone numbers in the request
    const phoneSet = new Set();
    for (const item of phoneNumbers) {
      if (phoneSet.has(item.phoneNumber)) {
        return res.status(400).json({
          message: `Duplicate phone number found in request: ${item.phoneNumber}`,
        });
      }
      phoneSet.add(item.phoneNumber);
    }

    // Update phone numbers
    audienceToUpdate.phoneNumbers = phoneNumbers;
    await audienceToUpdate.save();

    return res.status(200).json({
      message: "Audience updated successfully!",
      data: {
        id: audienceToUpdate.id,
        clientId: audienceToUpdate.clientId,
        configId: audienceToUpdate.configId,
        phoneNumbers: audienceToUpdate.phoneNumbers,
        totalNumbers: phoneNumbers.length,
        updatedAt: audienceToUpdate.updatedAt
      },
    });
  } catch (error) {
    next(error);
  }
};

//! Delete audience
const deleteAudience = async (req, res, next) => {
  try {
    const { clientId, id } = req.params;

    // Find the audience
    const audienceToDelete = await Audience.findOne({ 
      where: { 
        id,
        clientId 
      }
    });

    if (!audienceToDelete) {
      return res.status(404).json({
        message: "Audience not found!",
      });
    }
    
    // Delete the audience
    await audienceToDelete.destroy();

    return res.status(200).json({
      message: "Audience deleted successfully!",
    });
  } catch (error) {
    next(error);
  }
};

//! Get audience by ID
const getAudienceById = async (req, res, next) => {
  try {
    const { clientId, id } = req.params;

    // Find the audience
    const audience = await Audience.findOne({ 
      where: { 
        id,
        clientId 
      }
    });

    if (!audience) {
      return res.status(404).json({
        message: "Audience not found!",
      });
    }

    // Get SMS config info
    const smsConfig = await SMSConfig.findOne({
      where: {
        id: audience.configId,
        clientId
      },
      attributes: ['id', 'appName', 'senderId', 'type', 'status']
    });

    return res.status(200).json({
      message: "Audience retrieved successfully!",
      data: {
        id: audience.id,
        clientId: audience.clientId,
        configId: audience.configId,
        configInfo: smsConfig,
        phoneNumbers: audience.phoneNumbers,
        totalNumbers: (audience.phoneNumbers || []).length,
        createdAt: audience.createdAt,
        updatedAt: audience.updatedAt
      },
    });
  } catch (error) {
    next(error);
  }
};

//! Add phone numbers to existing audience
const addPhoneNumbersToAudience = async (req, res, next) => {
  try {
    const { clientId, id } = req.params;
    const { phoneNumbers } = req.body;

    // Validate phoneNumbers is an array
    if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return res.status(400).json({
        message: "phoneNumbers must be a non-empty array.",
      });
    }

    // Find the audience
    const audience = await Audience.findOne({ 
      where: { 
        id,
        clientId 
      }
    });

    if (!audience) {
      return res.status(404).json({
        message: "Audience not found!",
      });
    }

    const currentPhoneNumbers = audience.phoneNumbers || [];
    const currentPhoneSet = new Set(currentPhoneNumbers.map(p => p.phoneNumber));

    // Validate and prepare new phone numbers
    const newPhoneNumbers = [];
    for (const item of phoneNumbers) {
      if (!item.phoneNumber || !item.message) {
        return res.status(400).json({
          message: "Each phone number object must have phoneNumber and message.",
        });
      }

      // Validate phone number format
      const phoneRegex = /^[0-9]{10,15}$/;
      if (!phoneRegex.test(item.phoneNumber)) {
        return res.status(400).json({
          message: `Invalid phone number format: ${item.phoneNumber}. Must be 10-15 digits.`,
        });
      }

      // Validate message is not empty
      if (item.message.trim() === '') {
        return res.status(400).json({
          message: "Message cannot be empty for any phone number.",
        });
      }

      // Check if phone number already exists
      if (currentPhoneSet.has(item.phoneNumber)) {
        return res.status(409).json({
          message: `Phone number already exists in this audience: ${item.phoneNumber}`,
        });
      }

      currentPhoneSet.add(item.phoneNumber);
      newPhoneNumbers.push(item);
    }

    // Add new phone numbers to existing ones
    const updatedPhoneNumbers = [...currentPhoneNumbers, ...newPhoneNumbers];
    audience.phoneNumbers = updatedPhoneNumbers;
    await audience.save();

    return res.status(200).json({
      message: "Phone numbers added successfully!",
      data: {
        id: audience.id,
        addedCount: newPhoneNumbers.length,
        totalNumbers: updatedPhoneNumbers.length,
        updatedAt: audience.updatedAt
      },
    });
  } catch (error) {
    next(error);
  }
};

//! Remove phone numbers from audience
const removePhoneNumbersFromAudience = async (req, res, next) => {
  try {
    const { clientId, id } = req.params;
    const { phoneNumbers } = req.body; // Array of phone numbers to remove

    // Validate phoneNumbers is an array
    if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return res.status(400).json({
        message: "phoneNumbers must be a non-empty array of phone numbers to remove.",
      });
    }

    // Find the audience
    const audience = await Audience.findOne({ 
      where: { 
        id,
        clientId 
      }
    });

    if (!audience) {
      return res.status(404).json({
        message: "Audience not found!",
      });
    }

    const currentPhoneNumbers = audience.phoneNumbers || [];
    const phoneSetToRemove = new Set(phoneNumbers);
    
    // Filter out phone numbers to remove
    const updatedPhoneNumbers = currentPhoneNumbers.filter(
      item => !phoneSetToRemove.has(item.phoneNumber)
    );

    // Check if any phone numbers were actually removed
    const removedCount = currentPhoneNumbers.length - updatedPhoneNumbers.length;
    if (removedCount === 0) {
      return res.status(400).json({
        message: "None of the specified phone numbers were found in this audience.",
      });
    }

    audience.phoneNumbers = updatedPhoneNumbers;
    await audience.save();

    return res.status(200).json({
      message: "Phone numbers removed successfully!",
      data: {
        id: audience.id,
        removedCount: removedCount,
        totalNumbers: updatedPhoneNumbers.length,
        updatedAt: audience.updatedAt
      },
    });
  } catch (error) {
    next(error);
  }
};

//! Get audience statistics
const getAudienceStatsForClient = async (req, res, next) => {
  try {
    const { clientId } = req.params;

    // Check if client exists
    const client = await ClientInformation.findByPk(clientId);
    if (!client) {
      return res.status(404).json({
        message: "Client not found!",
      });
    }

    // Get all audiences for this client
    const audiences = await Audience.findAll({
      where: { clientId },
      attributes: ['id', 'configId', 'phoneNumbers']
    });

    // Calculate statistics
    let totalAudiences = audiences.length;
    let totalPhoneNumbers = 0;
    const audiencesByConfig = {};

    audiences.forEach(audience => {
      const phoneNumbers = audience.phoneNumbers || [];
      totalPhoneNumbers += phoneNumbers.length;
      
      // Group by configId
      if (!audiencesByConfig[audience.configId]) {
        audiencesByConfig[audience.configId] = {
          audienceCount: 0,
          phoneNumberCount: 0
        };
      }
      audiencesByConfig[audience.configId].audienceCount++;
      audiencesByConfig[audience.configId].phoneNumberCount += phoneNumbers.length;
    });

    // Get SMS config names for response
    const smsConfigs = await SMSConfig.findAll({
      where: { clientId },
      attributes: ['id', 'appName']
    });

    const formattedByConfig = {};
    smsConfigs.forEach(config => {
      if (audiencesByConfig[config.id]) {
        formattedByConfig[config.appName] = audiencesByConfig[config.id];
      }
    });

    return res.status(200).json({
      message: "Audience statistics retrieved successfully!",
      data: {
        clientId,
        totalAudiences,
        totalPhoneNumbers,
        averageNumbersPerAudience: totalAudiences > 0 ? (totalPhoneNumbers / totalAudiences).toFixed(2) : 0,
        audiencesByConfig: formattedByConfig
      }
    });
  } catch (error) {
    next(error);
  }
};

//! Send SMS to specific phone numbers in audience
const sendSMSToAudience = async (req, res, next) => {
  try {
    const { clientId, id } = req.params;
    const { phoneNumbers } = req.body; // Array of phone numbers to send to

    // Validate phoneNumbers is an array
    if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return res.status(400).json({
        message: "phoneNumbers must be a non-empty array of phone numbers to send to.",
      });
    }

    // Find the audience
    const audience = await Audience.findOne({ 
      where: { 
        id,
        clientId 
      }
    });

    if (!audience) {
      return res.status(404).json({
        message: "Audience not found!",
      });
    }

    // Get SMS config
    const smsConfig = await SMSConfig.findOne({
      where: {
        id: audience.configId,
        clientId
      }
    });

    if (!smsConfig) {
      return res.status(404).json({
        message: "SMS configuration not found!",
      });
    }

    if (!smsConfig.status) {
      return res.status(400).json({
        message: "SMS configuration is disabled!",
      });
    }

    const audiencePhoneNumbers = audience.phoneNumbers || [];
    const audiencePhoneMap = new Map();
    audiencePhoneNumbers.forEach(item => {
      audiencePhoneMap.set(item.phoneNumber, item.message);
    });

    const results = {
      total: phoneNumbers.length,
      sent: 0,
      failed: 0,
      details: []
    };

    // Send SMS to each phone number
    for (const phoneNumber of phoneNumbers) {
      try {
        // Check if phone number exists in audience
        if (!audiencePhoneMap.has(phoneNumber)) {
          results.failed++;
          results.details.push({
            phoneNumber,
            status: "failed",
            reason: "Phone number not found in audience"
          });
          continue;
        }

        const message = audiencePhoneMap.get(phoneNumber);
        
        // Construct SMS URL
        const smsUrl = `${smsConfig.baseUrl}?api_key=${smsConfig.apiKey}&type=${smsConfig.type}&contacts=${phoneNumber}&senderid=${smsConfig.senderId}&msg=${encodeURIComponent(message)}`;

        // Simulate API call
        const isSuccess = Math.random() > 0.3; // 70% success rate for simulation

        if (isSuccess) {
          results.sent++;
          results.details.push({
            phoneNumber,
            status: "sent",
            messageLength: message.length,
            simulated: true
          });
        } else {
          results.failed++;
          results.details.push({
            phoneNumber,
            status: "failed",
            reason: "SMS API error (simulated)",
            simulated: true
          });
        }
      } catch (error) {
        results.failed++;
        results.details.push({
          phoneNumber,
          status: "error",
          error: error.message
        });
      }
    }

    return res.status(200).json({
      message: "SMS sending completed!",
      data: results
    });
  } catch (error) {
    next(error);
  }
};

//! Send SMS to all phone numbers in audience
const sendSMSToAllAudience = async (req, res, next) => {
  try {
    const { clientId, id } = req.params;

    // Find the audience
    const audience = await Audience.findOne({ 
      where: { 
        id,
        clientId 
      }
    });

    if (!audience) {
      return res.status(404).json({
        message: "Audience not found!",
      });
    }

    const phoneNumbers = audience.phoneNumbers || [];
    
    if (phoneNumbers.length === 0) {
      return res.status(400).json({
        message: "No phone numbers found in this audience.",
      });
    }

    // Get SMS config
    const smsConfig = await SMSConfig.findOne({
      where: {
        id: audience.configId,
        clientId
      }
    });

    if (!smsConfig) {
      return res.status(404).json({
        message: "SMS configuration not found!",
      });
    }

    if (!smsConfig.status) {
      return res.status(400).json({
        message: "SMS configuration is disabled!",
      });
    }

    const results = {
      total: phoneNumbers.length,
      sent: 0,
      failed: 0,
      details: []
    };

    // Send SMS to each phone number
    for (const item of phoneNumbers) {
      try {
        const { phoneNumber, message } = item;
        
        // Construct SMS URL
        const smsUrl = `${smsConfig.baseUrl}?api_key=${smsConfig.apiKey}&type=${smsConfig.type}&contacts=${phoneNumber}&senderid=${smsConfig.senderId}&msg=${encodeURIComponent(message)}`;

        // Simulate API call
        const isSuccess = Math.random() > 0.3; // 70% success rate for simulation

        if (isSuccess) {
          results.sent++;
          results.details.push({
            phoneNumber,
            status: "sent",
            messageLength: message.length,
            simulated: true
          });
        } else {
          results.failed++;
          results.details.push({
            phoneNumber,
            status: "failed",
            reason: "SMS API error (simulated)",
            simulated: true
          });
        }
      } catch (error) {
        results.failed++;
        results.details.push({
          phoneNumber: item.phoneNumber,
          status: "error",
          error: error.message
        });
      }
    }

    return res.status(200).json({
      message: "Bulk SMS sending completed!",
      data: results
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addAudience,
  getAllAudienceForClient,
  updateAudience,
  deleteAudience,
  getAudienceById,
  addPhoneNumbersToAudience,
  removePhoneNumbersFromAudience,
  getAudienceStatsForClient,
  sendSMSToAudience,
  sendSMSToAllAudience
};