// controllers/SMSconfiguration/smsController.js
const { Op } = require("sequelize");
const ClientInformation = require("../../models/Authentication/client.model");
const SMSConfig = require("../../models/SMSconfiguration/smsConfig.model");
const SMSHistory = require("../../models/SMSconfiguration/smsHistory.model");
const { sendSMSHelper } = require("../../utils/helper/sendSMS");
const { saveSMSHistory } = require("../../utils/helper/smsHistoryHelper");
const sequelize = require("../../database/connection");
const { SMS_COST_PER_SMS, calculateUserBalance, deductSMSBalance } = require("../../utils/helper/deductSMSBalance");

// Send SMS to phone numbers
const SendSms = async (req, res, next) => {
  const t = await sequelize.transaction();
  
  try {
    const { clientId } = req.params;
    const { configId, phoneNumbers, messages } = req.body;

    // Validate required fields
    if (!configId || !phoneNumbers) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Config ID and phoneNumbers array are required.",
      });
    }

    // Validate phoneNumbers is an array
    if (!Array.isArray(phoneNumbers)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "phoneNumbers must be an array.",
      });
    }

    // Validate messages (if provided)
    if (messages && !Array.isArray(messages)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "messages must be an array if provided.",
      });
    }

    // Validate arrays length match
    if (messages && messages.length !== phoneNumbers.length) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "messages array length must match phoneNumbers array length.",
      });
    }

    // Validate each phone number
    for (let i = 0; i < phoneNumbers.length; i++) {
      const phoneNumber = phoneNumbers[i];
      
      if (!phoneNumber || typeof phoneNumber !== 'string') {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "Each phone number must be a string.",
        });
      }

      // Validate phone number format
      const phoneRegex = /^[0-9]{10,15}$/;
      if (!phoneRegex.test(phoneNumber.replace(/\D/g, ''))) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: `Invalid phone number format: ${phoneNumber}. Must be 10-15 digits.`,
        });
      }

      // Validate message if provided
      if (messages && messages[i] && messages[i].trim() === '') {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: `Message cannot be empty for phone number: ${phoneNumber}`,
        });
      }
    }

    // Check if client exists
    const client = await ClientInformation.findByPk(clientId, { transaction: t });
    if (!client) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Client not found!",
      });
    }

    // Check if SMS config exists and belongs to client
    const smsConfig = await SMSConfig.findOne({
      where: {
        id: configId,
        clientId: clientId
      },
      transaction: t
    });

    if (!smsConfig) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "SMS configuration not found or doesn't belong to this client!",
      });
    }

    // Check SMS config status
    if (!smsConfig.status) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "SMS configuration is disabled. Please enable it first.",
      });
    }

    // Calculate total SMS count and cost
    const smsCount = phoneNumbers.length;
    const totalCost = smsCount * SMS_COST_PER_SMS;

    // Check if user has sufficient balance
    const currentBalance = await calculateUserBalance(clientId, t);
    
    if (currentBalance < totalCost) {
      await t.rollback();
      return res.status(402).json({ // 402 Payment Required
        success: false,
        message: "Insufficient balance",
        data: {
          required: totalCost.toFixed(2),
          available: currentBalance.toFixed(2),
          smsCount: smsCount,
          costPerSMS: SMS_COST_PER_SMS
        }
      });
    }

    // Prepare SMS data
    const smsData = {
      apiKey: smsConfig.apiKey,
      type: smsConfig.type,
      senderId: smsConfig.senderId,
      configMessage: smsConfig.message,
      baseUrl: smsConfig.baseUrl || "https://msg.mram.com.bd/smsapi"
    };

    // Send SMS to each phone number
    const results = [];
    const errors = [];
    const smsHistoryPromises = [];

    for (let i = 0; i < phoneNumbers.length; i++) {
      const phoneNumber = phoneNumbers[i];
      
      try {
        // Use custom message if provided, otherwise use config message
        const messageToSend = messages && messages[i] 
          ? messages[i] 
          : smsConfig.message;

        const result = await sendSMSHelper(
          phoneNumber,
          messageToSend,
          smsData.apiKey,
          smsData.senderId,
          smsData.type,
          smsData.baseUrl
        );

        if (result.success) {
          results.push({
            phoneNumber,
            success: true,
            messageId: result.messageId,
            response: result.response,
            messageUsed: messages && messages[i] ? 'custom' : 'config'
          });

          // Save successful SMS to history
          const historyParams = {
            clientId: parseInt(clientId),
            configId: parseInt(configId),
            phoneNumber: phoneNumber,
            message: messageToSend,
            messageType: messages && messages[i] ? 'custom' : 'config',
            gatewayMessageId: result.messageId || null,
            gatewayResponse: result.response || null,
            characterCount: messageToSend.length,
            smsCount: 1, // Each SMS counts as 1
            cost: SMS_COST_PER_SMS // Add cost to history
          };

          // Save to history
          smsHistoryPromises.push(saveSMSHistory(historyParams));
          
        } else {
          errors.push({
            phoneNumber,
            error: result.message,
            response: result.response
          });
        }

        // Add a small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        errors.push({
          phoneNumber,
          error: error.message
        });
      }
    }

    // Only deduct balance if at least one SMS was sent successfully
    if (results.length > 0) {
      try {
        // Deduct balance for successfully sent SMS
        await deductSMSBalance(
          clientId, 
          results.length, 
          t
        );

        // console.log('Balance deduction result:', deductionResult);
      } catch (balanceError) {
        // If balance deduction fails, rollback everything
        await t.rollback();
        console.error('Balance deduction failed:', balanceError);
        
        return res.status(500).json({
          success: false,
          message: "Failed to deduct balance",
          error: balanceError.message
        });
      }
    }

    // Wait for all history saving to complete
    const historyResults = await Promise.allSettled(smsHistoryPromises);
    
    // Log any history saving failures
    historyResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Failed to save SMS history for index ${index}:`, result.reason);
      }
    });

    // Commit transaction
    await t.commit();

    // Calculate new balance after deductions
    const newBalance = await calculateUserBalance(clientId);

    // Prepare response
    const response = {
      success: errors.length === 0 || results.length > 0,
      message: `SMS sent to ${results.length} numbers, ${errors.length} failed`,
      data: {
        total: phoneNumbers.length,
        successful: results.length,
        failed: errors.length,
        costBreakdown: {
          totalCost: (results.length * SMS_COST_PER_SMS).toFixed(2),
          costPerSMS: SMS_COST_PER_SMS.toFixed(2),
          newBalance: newBalance.toFixed(2)
        },
        results: results,
        errors: errors.length > 0 ? errors : undefined
      }
    };

    return res.status(response.success ? 200 : 207).json(response);

  } catch (error) {
    await t.rollback();
    console.error('SendSMS Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to send SMS",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


// Get SMS History for Admin
const getSMSHistory = async (req, res, next) => {
  try {
    // Get query parameters
    const {
      page = 1,
      limit = 20,
      clientId,
      configId,
      phoneNumber,
      messageType,
      status,
      deliveryStatus,
      startDate,
      endDate,
      search,
      sortBy = 'sentAt',
      sortOrder = 'DESC'
    } = req.query;

    // Calculate pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    // Build where conditions
    const whereConditions = {};

    // Filter by clientId
    if (clientId) {
      whereConditions.clientId = parseInt(clientId);
    }

    // Filter by configId
    if (configId) {
      whereConditions.configId = parseInt(configId);
    }

    // Filter by phoneNumber
    if (phoneNumber) {
      whereConditions.phoneNumber = {
        [Op.like]: `%${phoneNumber.replace(/\D/g, '')}%`
      };
    }

    // Filter by messageType
    if (messageType && ['config', 'custom'].includes(messageType)) {
      whereConditions.messageType = messageType;
    }

    // Filter by status
    if (status && ['sent', 'failed', 'delivered', 'pending'].includes(status)) {
      whereConditions.status = status;
    }

    // Filter by deliveryStatus
    if (deliveryStatus && ['pending', 'delivered', 'failed', 'unknown'].includes(deliveryStatus)) {
      whereConditions.deliveryStatus = deliveryStatus;
    }

    // Filter by date range
    if (startDate || endDate) {
      whereConditions.sentAt = {};
      
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        whereConditions.sentAt[Op.gte] = start;
      }
      
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereConditions.sentAt[Op.lte] = end;
      }
    }

    // Search by message content or phone number
    if (search) {
      const searchQuery = `%${search}%`;
      whereConditions[Op.or] = [
        { message: { [Op.like]: searchQuery } },
        { phoneNumber: { [Op.like]: searchQuery } }
      ];
    }

    // Validate sort order
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    // Validate sort by field
    const validSortFields = ['id', 'clientId', 'configId', 'phoneNumber', 'sentAt', 'status', 'deliveryStatus', 'smsCount', 'cost'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'sentAt';

    // Get total count for pagination
    const totalCount = await SMSHistory.count({
      where: whereConditions
    });

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / limitNum);

    // Get SMS history with pagination and filters
    const smsHistory = await SMSHistory.findAll({
      where: whereConditions,
      order: [[sortField, validSortOrder]],
      limit: limitNum,
      offset: offset
    });

    // Get unique client IDs from the history
    const clientIds = [...new Set(smsHistory.map(item => item.clientId))];
    
    // Get client information for these IDs
    const clients = await ClientInformation.findAll({
      where: {
        id: {
          [Op.in]: clientIds
        }
      },
      attributes: ['id', 'fullName', 'mobileNo', 'email']
    });

    // Get unique config IDs from the history
    const configIds = [...new Set(smsHistory.map(item => item.configId))];
    
    // Get SMS config information for these IDs
    const smsConfigs = await SMSConfig.findAll({
      where: {
        id: {
          [Op.in]: configIds
        }
      },
      attributes: ['id', 'appName', 'senderId', 'type', 'clientId']
    });

    // Create maps for quick lookup
    const clientMap = {};
    clients.forEach(client => {
      clientMap[client.id] = {
        id: client.id,
        fullName: client.fullName,
        mobileNo: client.mobileNo,
        email: client.email
      };
    });

    const configMap = {};
    smsConfigs.forEach(config => {
      configMap[config.id] = {
        id: config.id,
        appName: config.appName,
        senderId: config.senderId,
        type: config.type,
        clientId: config.clientId
      };
    });

    // Enrich SMS history with client and config details
    const enrichedHistory = smsHistory.map(item => {
      const itemData = item.toJSON ? item.toJSON() : item;
      
      return {
        ...itemData,
        clientDetails: clientMap[item.clientId] || null,
        configDetails: configMap[item.configId] || null
      };
    });

    // Response data
    const response = {
      success: true,
      message: 'SMS history retrieved successfully',
      data: {
        pagination: {
          currentPage: pageNum,
          totalPages: totalPages,
          totalItems: totalCount,
          itemsPerPage: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPreviousPage: pageNum > 1
        },
        history: enrichedHistory
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Get SMS History Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve SMS history",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};



module.exports = {
  SendSms,
  getSMSHistory
};