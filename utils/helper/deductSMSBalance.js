const sequelize = require("../../database/connection");
const PaymentTransaction = require("../../models/Authentication/payment-transaction.model");
const { Op } = require("sequelize");

const SMS_COST_PER_SMS = 0.50; // 50 poisha per SMS

/**
 * Deduct SMS cost from user's balance
 * @param {number} userId - The user ID
 * @param {number} smsCount - Number of SMS sent
 * @param {object} transaction - Sequelize transaction object
 * @returns {Promise<object>} - Result of deduction
 */
const deductSMSBalance = async (userId, smsCount, transaction = null) => {
  const t = transaction || await sequelize.transaction();
  
  try {
    const totalCost = smsCount * SMS_COST_PER_SMS;
    
    // Get all completed transactions with positive balance
    const userTransactions = await PaymentTransaction.findAll({
      where: {
        userId: userId,
        status: 'completed',
        amount: { [Op.gt]: 0 }
      },
      order: [['completedAt', 'ASC'], ['createdAt', 'ASC']],
      transaction: t
    });

    if (userTransactions.length === 0) {
      throw new Error(`No balance found for user ${userId}`);
    }

    console.log('Found transactions:', userTransactions.map(t => ({
      id: t.id,
      amount: t.amount,
      userDataType: typeof t.userData,
      userDataLength: typeof t.userData === 'string' ? t.userData.length : 'N/A'
    })));

    // Calculate total available balance
    const totalBalance = userTransactions.reduce((sum, trans) => sum + parseFloat(trans.amount), 0);
    
    if (totalBalance < totalCost) {
      throw new Error(`Insufficient balance. Available: ${totalBalance} BDT, Required: ${totalCost} BDT`);
    }

    let remainingToDeduct = totalCost;
    const deductionDetails = [];

    // Deduct from transactions using FIFO
    for (const transaction of userTransactions) {
      if (remainingToDeduct <= 0) break;

      const currentAmount = parseFloat(transaction.amount);
      
      // SAFELY handle userData - if it's corrupted, reset it
      let currentUserData = {};
      try {
        if (transaction.userData) {
          if (typeof transaction.userData === 'string') {
            // If it's too long, it's corrupted - reset it
            if (transaction.userData.length > 10000) {
              console.log(`Resetting corrupted userData for transaction ${transaction.id}`);
              currentUserData = { 
                reset: true, 
                resetAt: new Date(),
                originalLength: transaction.userData.length 
              };
            } else {
              currentUserData = JSON.parse(transaction.userData) || {};
            }
          } else if (typeof transaction.userData === 'object') {
            currentUserData = transaction.userData;
          }
        }
      } catch (e) {
        console.log(`Error parsing userData for transaction ${transaction.id}:`, e.message);
        currentUserData = { parseError: true, resetAt: new Date() };
      }
      
      if (currentAmount >= remainingToDeduct) {
        // This transaction has enough balance
        const newAmount = currentAmount - remainingToDeduct;
        
        await transaction.update(
          { 
            amount: newAmount.toFixed(2),
            userData: {
              ...currentUserData,
              lastDeduction: {
                amount: remainingToDeduct,
                date: new Date(),
                smsCount: smsCount
              }
            }
          },
          { transaction: t }
        );

        deductionDetails.push({
          transactionId: transaction.id,
          deducted: remainingToDeduct,
          remainingBalance: newAmount
        });

        remainingToDeduct = 0;
      } else {
        // This transaction doesn't have enough, deduct all from it
        await transaction.update(
          { 
            amount: 0,
            userData: {
              ...currentUserData,
              fullyConsumed: true,
              consumedAt: new Date(),
              consumedAmount: currentAmount
            }
          },
          { transaction: t }
        );

        deductionDetails.push({
          transactionId: transaction.id,
          deducted: currentAmount,
          remainingBalance: 0
        });

        remainingToDeduct -= currentAmount;
      }
    }

    // Calculate new total balance
    const newTotalBalance = await calculateUserBalance(userId, t);

    const result = {
      success: true,
      userId,
      smsCount,
      totalCost,
      remainingToDeduct,
      deductionDetails,
      newTotalBalance
    };

    if (!transaction) {
      await t.commit();
    }

    return result;

  } catch (error) {
    if (!transaction) {
      await t.rollback();
    }
    console.error('Balance deduction error:', error);
    throw error;
  }
};

/**
 * Calculate user's current total balance
 * @param {number} userId 
 * @param {object} transaction 
 * @returns {Promise<number>}
 */
const calculateUserBalance = async (userId, transaction = null) => {
  const result = await PaymentTransaction.findAll({
    where: {
      userId: userId,
      status: 'completed',
    },
    attributes: [
      [sequelize.fn('SUM', sequelize.col('amount')), 'totalBalance']
    ],
    raw: true,
    transaction
  });

  return parseFloat(result[0]?.totalBalance || 0);
};

/**
 * Check if user has sufficient balance
 * @param {number} userId 
 * @param {number} smsCount 
 * @returns {Promise<boolean>}
 */
const hasSufficientBalance = async (userId, smsCount) => {
  try {
    const totalCost = smsCount * SMS_COST_PER_SMS;
    const currentBalance = await calculateUserBalance(userId);
    return currentBalance >= totalCost;
  } catch (error) {
    console.error('Error checking balance:', error);
    return false;
  }
};

/**
 * Get user's balance breakdown
 * @param {number} userId 
 * @returns {Promise<object>}
 */
const getUserBalanceBreakdown = async (userId) => {
  const transactions = await PaymentTransaction.findAll({
    where: {
      userId: userId,
      status: 'completed',
      amount: { [Op.gt]: 0 }
    },
    order: [['completedAt', 'ASC']]
  });

  const totalBalance = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  
  return {
    userId,
    totalBalance,
    transactionCount: transactions.length,
    transactions: transactions.map(t => ({
      id: t.id,
      transactionId: t.transactionId,
      amount: t.amount,
      completedAt: t.completedAt,
      remainingBalance: t.amount
    }))
  };
};

module.exports = {
  deductSMSBalance,



  calculateUserBalance,
  hasSufficientBalance,
  getUserBalanceBreakdown,
  SMS_COST_PER_SMS
};