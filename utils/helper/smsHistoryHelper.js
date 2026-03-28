// utils/helper/smsHistoryHelper.js
const SMSHistory = require("../../models/SMSconfiguration/smsHistory.model");

const saveSMSHistory = async (params) => {
  try {
    const {
      clientId,
      configId,
      phoneNumber,
      message,
      messageType = 'config',
      gatewayMessageId = null,
      gatewayResponse = null,
      characterCount,
      smsCount = 1,
      cost = 0.00
    } = params;

    // Validate required parameters
    if (!clientId || !configId || !phoneNumber || !message) {
      throw new Error('Missing required parameters for SMS history');
    }

    // Clean phone number
    const cleanPhoneNumber = phoneNumber.replace(/\D/g, '');

    // Calculate SMS segments (assuming 160 characters per SMS)
    const calculatedSmsCount = Math.ceil(message.length / 160);

    // Create SMS history record
    const smsRecord = await SMSHistory.create({
      clientId,
      configId,
      phoneNumber: cleanPhoneNumber,
      message,
      messageType,
      gatewayMessageId,
      gatewayResponse: gatewayResponse ? JSON.stringify(gatewayResponse) : null,
      status: 'sent',
      characterCount: characterCount || message.length,
      smsCount: smsCount || calculatedSmsCount,
      cost,
      sentAt: new Date()
    });

    return {
      success: true,
      data: smsRecord,
      message: 'SMS history saved successfully'
    };

  } catch (error) {
    console.error('Error saving SMS history:', error.message);
    
    // Don't throw error, just log it so SMS sending can continue
    return {
      success: false,
      message: error.message,
      error: error
    };
  }
};

const updateSMSDeliveryStatus = async (smsHistoryId, status, gatewayMessageId = null) => {
  try {
    const updateData = {
      deliveryStatus: status,
      deliveryConfirmedAt: new Date()
    };

    if (gatewayMessageId) {
      updateData.gatewayMessageId = gatewayMessageId;
    }

    const updatedRecord = await SMSHistory.update(updateData, {
      where: { id: smsHistoryId },
      returning: true
    });

    return {
      success: true,
      data: updatedRecord[1][0],
      message: 'SMS delivery status updated'
    };

  } catch (error) {
    console.error('Error updating SMS delivery status:', error.message);
    return {
      success: false,
      message: error.message,
      error: error
    };
  }
};


const bulkSaveSMSHistory = async (smsRecords) => {
  try {
    if (!Array.isArray(smsRecords) || smsRecords.length === 0) {
      return {
        success: false,
        message: 'No SMS records to save'
      };
    }

    const savedRecords = [];
    const failedRecords = [];

    // Save records one by one to handle individual failures
    for (const record of smsRecords) {
      try {
        const result = await saveSMSHistory(record);
        if (result.success) {
          savedRecords.push(result.data);
        } else {
          failedRecords.push({
            record,
            error: result.message
          });
        }
      } catch (error) {
        failedRecords.push({
          record,
          error: error.message
        });
      }
    }

    return {
      success: savedRecords.length > 0,
      data: {
        saved: savedRecords.length,
        failed: failedRecords.length,
        savedRecords,
        failedRecords
      },
      message: `Saved ${savedRecords.length} records, ${failedRecords.length} failed`
    };

  } catch (error) {
    console.error('Error in bulk save SMS history:', error.message);
    return {
      success: false,
      message: error.message,
      error: error
    };
  }
};




module.exports = {
  saveSMSHistory,
  updateSMSDeliveryStatus,
  bulkSaveSMSHistory
};