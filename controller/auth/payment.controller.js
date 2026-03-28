const { Op } = require("sequelize");
const SSLCommerzPayment = require("sslcommerz-lts");
const ClientInformation = require("../../models/Authentication/client.model");
const PaymentTransaction = require("../../models/Authentication/payment-transaction.model");
const sequelize = require("../../database/connection");
const SMSConfig = require("../../models/SMSconfiguration/smsConfig.model");

const store_id = process.env.SSL_STORE_ID || "linux699074745baa8";
const store_passwd = process.env.SSL_STORE_PASSWORD || "linux699074745baa8@ssl";
const is_live = process.env.SSL_IS_LIVE === "true" ? true : false;

const baseURL = "https://server.linuxeon.com";
const frontendURL = "https://linuxeon.com";



//! For development.............
// const baseURL = "http://localhost:2000";
// const frontendURL = "http://localhost:3000";

// Generate unique transaction ID
const generateTransactionId = () => {
  return (
    "TXN_" + Date.now() + "_" + Math.random().toString(36).substring(2, 10)
  );
};

//! Process payment and return gateway URL
const processPayment = async (req, res, next) => {
  const t = await sequelize.transaction();

  try {
    const { userId, amount, paymentMethod, payload } = req.body;

    if (!userId || !amount || !payload) {
      return res.status(400).json({
        success: false,
        message: "User ID, amount and payload are required",
      });
    }

    // Check if user exists
    const user = await ClientInformation.findByPk(userId, { transaction: t });

    if (!user) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user already has a pending transaction
    const existingTransaction = await PaymentTransaction.findOne({
      where: {
        userId: userId,
        status: "pending",
      },
      transaction: t,
    });

    if (existingTransaction) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: "You already have a pending payment. Please complete that first.",
        data: {
          transactionId: existingTransaction.transactionId,
        },
      });
    }

    // Generate unique transaction ID
    const tran_id = generateTransactionId();

    // Create payment transaction record
    const paymentTransaction = await PaymentTransaction.create(
      {
        userId: userId,
        transactionId: tran_id,
        amount: amount,
        paymentMethod: paymentMethod,
        status: "pending",
        userData: payload,
        createdAt: new Date(),
      },
      { transaction: t },
    );

    // SSLCommerz data
    const sslData = {
      total_amount: amount,
      currency: "BDT",
      tran_id: tran_id,
      success_url: `${baseURL}/payment/success?tran_id=${tran_id}`,
      fail_url: `${baseURL}/payment/fail?tran_id=${tran_id}`,
      cancel_url: `${baseURL}/payment/cancel?tran_id=${tran_id}`,
      ipn_url: `${baseURL}/payment/ipn`,
      shipping_method: "No",
      product_name: "Account Activation Fee",
      product_category: "Service",
      product_profile: "general",
      cus_name: payload.fullName || "Customer",
      cus_email: payload.email || "customer@example.com",
      cus_add1: "Dhaka",
      cus_add2: "Dhaka",
      cus_city: "Dhaka",
      cus_state: "Dhaka",
      cus_postcode: "1000",
      cus_country: "Bangladesh",
      cus_phone: payload.mobileNo || "01700000000",
      cus_fax: payload.mobileNo || "01700000000",
      ship_name: payload.fullName || "Customer",
      ship_add1: "Dhaka",
      ship_add2: "Dhaka",
      ship_city: "Dhaka",
      ship_state: "Dhaka",
      ship_postcode: "1000",
      ship_country: "Bangladesh",
    };

    // Initialize SSLCommerz
    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
    const apiResponse = await sslcz.init(sslData);

    await t.commit();

    console.log(apiResponse)

    if (apiResponse && apiResponse.GatewayPageURL) {
      return res.status(200).json({
        success: true,
        message: "Payment gateway initialized successfully",
        data: {
          gatewayUrl: apiResponse.GatewayPageURL,
          transactionId: tran_id,
        },
      });
    } else {
      // Update transaction status to failed if SSLCommerz init fails
      await paymentTransaction.update({ status: "failed" });

      return res.status(500).json({
        success: false,
        message: "Failed to initialize payment gateway",
        error: apiResponse,
      });
    }
  } catch (error) {
    await t.rollback();
    console.error("Payment processing error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process payment",
      error: error.message,
    });
  }
};

//! Payment Success Callback - Redirect to frontend success page
const paymentSuccess = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const {
      tran_id,
      val_id,
      amount,
      card_type,
      bank_tran_id,
      currency,
      card_no,
      card_issuer,
      card_brand,
      currency_amount,
      risk_level,
    } = req.body;

    console.log(tran_id);

    // Find the transaction
    const paymentTransaction = await PaymentTransaction.findOne({
      where: { transactionId: tran_id },
      transaction: t,
    });

    if (!paymentTransaction) {
      await t.rollback();
      return res.redirect(`${frontendURL}/payment/success?tran_id=${tran_id}`);
    }

    // Check if already processed
    if (paymentTransaction.status === "completed") {
      await t.rollback();
      return res.redirect(`${frontendURL}/payment/success?tran_id=${tran_id}`);
    }

    // Update transaction with payment details
    await paymentTransaction.update(
      {
        status: "completed",
        valId: val_id,
        bankTransactionId: bank_tran_id,
        cardType: card_type,
        cardNo: card_no,
        cardIssuer: card_issuer,
        cardBrand: card_brand,
        currency: currency,
        currencyAmount: currency_amount,
        riskLevel: risk_level,
        completedAt: new Date(),
      },
      { transaction: t },
    );

    // Update user status to active
    const user = await ClientInformation.findByPk(paymentTransaction.userId, {
      transaction: t,
    });

    if (user) {
      const userData = paymentTransaction.userData || {};

      await user.update(
        {
          status: "active",
          fullName: userData.fullName || user.fullName,
          photo: userData.photo || user.photo,
          dateOfBirth: userData.dateOfBirth || user.dateOfBirth,
          age: userData.age || user.age,
          sex: userData.sex || user.sex,
          nidOrPassportNo: userData.nidOrPassportNo || user.nidOrPassportNo,
          nidPhotoFrontSide: userData.nidPhotoFrontSide || user.nidPhotoFrontSide,
          nidPhotoBackSide: userData.nidPhotoBackSide || user.nidPhotoBackSide,
          mobileNo: userData.mobileNo || user.mobileNo,
          email: userData.email || user.email,
        },
        { transaction: t },
      );
    }
    await t.commit();
    // Redirect to your frontend success page with transaction ID
    return res.redirect(`${frontendURL}/payment/success?tran_id=${tran_id}`);
  } catch (error) {
    await t.rollback();
    console.error("Payment success callback error:", error);
    return res.redirect(`${frontendURL}/payment/fail`);
  }
};

//! Payment Fail Callback - Redirect to frontend fail page
const paymentFail = async (req, res) => {
  try {
    const { tran_id } = req.body;

    const paymentTransaction = await PaymentTransaction.findOne({
      where: { transactionId: tran_id },
    });

    if (paymentTransaction) {
      await paymentTransaction.update({
        status: "failed",
        errorMessage: "Payment failed",
      });
    }

    // Redirect to your frontend fail page
    return res.redirect(`${frontendURL}/payment/fail?tran_id=${tran_id}`);
    
  } catch (error) {
    console.error("Payment fail callback error:", error);
    // Redirect to frontend fail page with error
    return res.redirect(`${frontendURL}/payment/fail?tran_id=${tran_id}`);
  }
};

//! Payment Cancel Callback - Redirect to frontend cancel page
const paymentCancel = async (req, res) => {
  try {
    const { tran_id } = req.body;

    const paymentTransaction = await PaymentTransaction.findOne({
      where: { transactionId: tran_id },
    });

    if (paymentTransaction) {
      await paymentTransaction.update({
        status: "cancelled",
      });
    }

    // Redirect to your frontend cancel page
    return res.redirect(`${frontendURL}/payment/cancel?tran_id=${tran_id}`);
    
  } catch (error) {
    console.error("Payment cancel callback error:", error);
    // Redirect to frontend cancel page with error
    return res.redirect(`${frontendURL}/payment/cancel?tran_id=${tran_id}`);
  }
};

//! Payment IPN (Instant Payment Notification) - Keep as is for backend processing
const paymentIpn = async (req, res) => {
  try {
    const {
      tran_id,
      val_id,
      amount,
      card_type,
      bank_tran_id,
      status,
      currency,
    } = req.body;

    console.log("IPN Received:", { tran_id, val_id, status });

    // Find the transaction
    const paymentTransaction = await PaymentTransaction.findOne({
      where: { transactionId: tran_id },
    });

    if (paymentTransaction && paymentTransaction.status === "pending") {
      // Update transaction status
      await paymentTransaction.update({
        status: status === "VALID" ? "completed" : "failed",
        valId: val_id,
        bankTransactionId: bank_tran_id,
        cardType: card_type,
        currency: currency,
        completedAt: status === "VALID" ? new Date() : null,
      });

      // If payment is valid, update user status
      if (status === "VALID") {
        const user = await ClientInformation.findByPk(
          paymentTransaction.userId,
        );
        if (user) {
          const userData = paymentTransaction.userData || {};
          await user.update({
            status: "active",
            fullName: userData.fullName || user.fullName,
            photo: userData.photo || user.photo,
            dateOfBirth: userData.dateOfBirth || user.dateOfBirth,
            age: userData.age || user.age,
            sex: userData.sex || user.sex,
            nidOrPassportNo: userData.nidOrPassportNo || user.nidOrPassportNo,
            nidPhotoFrontSide: userData.nidPhotoFrontSide || user.nidPhotoFrontSide,
            nidPhotoBackSide: userData.nidPhotoBackSide || user.nidPhotoBackSide,
            mobileNo: userData.mobileNo || user.mobileNo,
            email: userData.email || user.email,
          });
        }
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("IPN processing error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};











//! Check payment status by transaction ID
const checkPaymentStatus = async (req, res) => {
  try {
    const { tran_id } = req.params;

    if (!tran_id) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID is required",
      });
    }

    // Find the transaction without associations
    const paymentTransaction = await PaymentTransaction.findOne({
      where: { transactionId: tran_id }
    });

    if (!paymentTransaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    // If you need user information, fetch it separately
    let userInfo = null;
    if (paymentTransaction.userId) {
      try {
        userInfo = await ClientInformation.findByPk(paymentTransaction.userId, {
          attributes: ['id', 'fullName', 'email', 'mobileNo', 'status', 'photo', 'dateOfBirth', 'age', 'sex', 'nidOrPassportNo']
        });
      } catch (userError) {
        console.error("Error fetching user info:", userError);
        // Continue even if user fetch fails
      }
    }

    // Return payment information
    return res.status(200).json({
      success: true,
      message: "Payment information retrieved successfully",
      data: {
        transaction: {
          id: paymentTransaction.id,
          transactionId: paymentTransaction.transactionId,
          amount: paymentTransaction.amount,
          currency: paymentTransaction.currency,
          status: paymentTransaction.status,
          paymentMethod: paymentTransaction.paymentMethod,
          cardType: paymentTransaction.cardType,
          cardIssuer: paymentTransaction.cardIssuer,
          cardBrand: paymentTransaction.cardBrand,
          bankTransactionId: paymentTransaction.bankTransactionId,
          valId: paymentTransaction.valId,
          riskLevel: paymentTransaction.riskLevel,
          errorMessage: paymentTransaction.errorMessage,
          createdAt: paymentTransaction.createdAt,
          completedAt: paymentTransaction.completedAt,
        },
        user: userInfo ? {
          id: userInfo.id,
          fullName: userInfo.fullName,
          email: userInfo.email,
          mobileNo: userInfo.mobileNo,
          status: userInfo.status,
          photo: userInfo.photo,
          dateOfBirth: userInfo.dateOfBirth,
          age: userInfo.age,
          sex: userInfo.sex,
          nidOrPassportNo: userInfo.nidOrPassportNo,
        } : null,
        userData: paymentTransaction.userData, // Original payload data
      },
    });

  } catch (error) {
    console.error("Check payment status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check payment status",
      error: error.message,
    });
  }
};

//! Check payment status by user ID (optional - get all transactions for a user)
const checkUserPayments = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Find all transactions for the user
    const paymentTransactions = await PaymentTransaction.findAll({
      where: { userId: userId },
      order: [['createdAt', 'DESC']], // Most recent first
    });

    if (!paymentTransactions || paymentTransactions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No transactions found for this user",
      });
    }

    // Format the transactions data
    const formattedTransactions = paymentTransactions.map(transaction => ({
      id: transaction.id,
      transactionId: transaction.transactionId,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.status,
      paymentMethod: transaction.paymentMethod,
      cardType: transaction.cardType,
      cardIssuer: transaction.cardIssuer,
      cardBrand: transaction.cardBrand,
      bankTransactionId: transaction.bankTransactionId,
      valId: transaction.valId,
      riskLevel: transaction.riskLevel,
      errorMessage: transaction.errorMessage,
      createdAt: transaction.createdAt,
      completedAt: transaction.completedAt,
    }));

    return res.status(200).json({
      success: true,
      message: "User payments retrieved successfully",
      data: {
        userId: parseInt(userId),
        totalTransactions: formattedTransactions.length,
        transactions: formattedTransactions,
      },
    });

  } catch (error) {
    console.error("Check user payments error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check user payments",
      error: error.message,
    });
  }
};























//! For balance recharge
const processRechargePayment = async (req, res, next) => {
  const t = await sequelize.transaction();

  try {
    const { userId, amount, paymentMethod, payload } = req.body;

    if (!userId || !amount || !payload) {
      return res.status(400).json({
        success: false,
        message: "User ID, amount and payload are required",
      });
    }

    // Check if user exists
    const user = await ClientInformation.findByPk(userId, { transaction: t });

    if (!user) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user already has a pending transaction
    const existingTransaction = await PaymentTransaction.findOne({
      where: {
        userId: userId,
        status: "pending",
      },
      transaction: t,
    });

    if (existingTransaction) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: "You already have a pending payment. Please complete that first.",
        data: {
          transactionId: existingTransaction.transactionId,
        },
      });
    }

    // Generate unique transaction ID
    const tran_id = generateTransactionId();

    // Create payment transaction record with type 'recharge'
    const paymentTransaction = await PaymentTransaction.create(
      {
        userId: userId,
        transactionId: tran_id,
        amount: amount,
        paymentMethod: paymentMethod,
        status: "pending",
        userData: { ...payload, transactionType: 'recharge' }, // Mark as recharge
        createdAt: new Date(),
      },
      { transaction: t },
    );

    // SSLCommerz data
    const sslData = {
      total_amount: amount,
      currency: "BDT",
      tran_id: tran_id,
      success_url: `${baseURL}/payment/recharge-success?tran_id=${tran_id}`,
      fail_url: `${baseURL}/payment/recharge-fail?tran_id=${tran_id}`,
      cancel_url: `${baseURL}/payment/recharge-cancel?tran_id=${tran_id}`,
      ipn_url: `${baseURL}/payment/recharge-ipn`,
      shipping_method: "No",
      product_name: "SMS Balance Recharge",
      product_category: "Recharge",
      product_profile: "general",
      cus_name: payload.fullName || "Customer",
      cus_email: payload.email || "customer@example.com",
      cus_add1: "Dhaka",
      cus_add2: "Dhaka",
      cus_city: "Dhaka",
      cus_state: "Dhaka",
      cus_postcode: "1000",
      cus_country: "Bangladesh",
      cus_phone: payload.mobileNo || "01700000000",
      cus_fax: payload.mobileNo || "01700000000",
      ship_name: payload.fullName || "Customer",
      ship_add1: "Dhaka",
      ship_add2: "Dhaka",
      ship_city: "Dhaka",
      ship_state: "Dhaka",
      ship_postcode: "1000",
      ship_country: "Bangladesh",
    };

    // Initialize SSLCommerz
    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
    const apiResponse = await sslcz.init(sslData);

    await t.commit();

    console.log(apiResponse)

    if (apiResponse && apiResponse.GatewayPageURL) {
      return res.status(200).json({
        success: true,
        message: "Recharge payment gateway initialized successfully",
        data: {
          gatewayUrl: apiResponse.GatewayPageURL,
          transactionId: tran_id,
        },
      });
    } else {
      // Update transaction status to failed if SSLCommerz init fails
      await paymentTransaction.update({ status: "failed" });

      return res.status(500).json({
        success: false,
        message: "Failed to initialize payment gateway",
        error: apiResponse,
      });
    }
  } catch (error) {
    await t.rollback();
    console.error("Recharge payment processing error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process recharge payment",
      error: error.message,
    });
  }
};

//! Recharge Payment Success Callback
const rechargePaymentSuccess = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const {
      tran_id,
      val_id,
      amount,
      card_type,
      bank_tran_id,
      currency,
      card_no,
      card_issuer,
      card_brand,
      currency_amount,
      risk_level,
    } = req.body;

    console.log("Recharge Success:", tran_id);

    // Find the transaction
    const paymentTransaction = await PaymentTransaction.findOne({
      where: { transactionId: tran_id },
      transaction: t,
    });

    if (!paymentTransaction) {
      await t.rollback();
      return res.redirect(`${frontendURL}/payment/fail`);
    }

    // Check if already processed
    if (paymentTransaction.status === "completed") {
      await t.rollback();
      
      return res.redirect(
        `${frontendURL}/payment/success?tran_id=${tran_id}`
      );
    }

    // Update transaction with payment details
    await paymentTransaction.update(
      {
        status: "completed",
        valId: val_id,
        bankTransactionId: bank_tran_id,
        cardType: card_type,
        cardNo: card_no,
        cardIssuer: card_issuer,
        cardBrand: card_brand,
        currency: currency,
        currencyAmount: currency_amount,
        riskLevel: risk_level,
        completedAt: new Date(),
      },
      { transaction: t },
    );

    await t.commit();

    // Redirect to frontend recharge success page with balance info
    return res.redirect(
      `${frontendURL}/payment/success?tran_id=${tran_id}`
    );
    
  } catch (error) {
    await t.rollback();
    console.error("Recharge payment success callback error:", error);
    return res.redirect(`${frontendURL}/payment/fail`);
  }
};

//! Recharge Payment Fail Callback
const rechargePaymentFail = async (req, res) => {
  try {
    const { tran_id } = req.body;

    const paymentTransaction = await PaymentTransaction.findOne({
      where: { transactionId: tran_id },
    });

    if (paymentTransaction) {
      await paymentTransaction.update({
        status: "failed",
        errorMessage: "Recharge payment failed",
      });
    }

    return res.redirect(`${frontendURL}/payment/fail?tran_id=${tran_id}`);
    
  } catch (error) {
    console.error("Recharge payment fail callback error:", error);
    return res.redirect(`${frontendURL}/payment/fail`);
  }
};

//! Recharge Payment Cancel Callback
const rechargePaymentCancel = async (req, res) => {
  try {
    const { tran_id } = req.body;

    const paymentTransaction = await PaymentTransaction.findOne({
      where: { transactionId: tran_id },
    });

    if (paymentTransaction) {
      await paymentTransaction.update({
        status: "cancelled",
      });
    }

    return res.redirect(`${frontendURL}/payment/cancel?tran_id=${tran_id}`);
    
  } catch (error) {
    console.error("Recharge payment cancel callback error:", error);
    return res.redirect(`${frontendURL}/payment/cancel`);
  }
};

//! Recharge Payment IPN
const rechargePaymentIpn = async (req, res) => {
  try {
    const {
      tran_id,
      val_id,
      amount,
      card_type,
      bank_tran_id,
      status,
      currency,
    } = req.body;

    console.log("Recharge IPN Received:", { tran_id, val_id, status });

    // Find the transaction
    const paymentTransaction = await PaymentTransaction.findOne({
      where: { transactionId: tran_id },
    });

    if (paymentTransaction && paymentTransaction.status === "pending") {
      // Update transaction status
      await paymentTransaction.update({
        status: status === "VALID" ? "completed" : "failed",
        valId: val_id,
        bankTransactionId: bank_tran_id,
        cardType: card_type,
        currency: currency,
        completedAt: status === "VALID" ? new Date() : null,
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Recharge IPN processing error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};






const getUserBalance = async (userId) => {
  try {
    const result = await PaymentTransaction.findAll({
      where: {
        userId: userId,
        status: 'completed',
      },
      attributes: [
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalBalance']
      ],
      raw: true,
    });

    return parseFloat(result[0]?.totalBalance || 0);
  } catch (error) {
    console.error("Error calculating user balance:", error);
    return 0;
  }
};



//! Optional: Endpoint to get just the current balance
const getCurrentBalance = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const balance = await getUserBalance(userId);

    return res.status(200).json({
      success: true,
      message: "Current balance retrieved successfully",
      data: {
        userId: parseInt(userId),
        balance: balance.toFixed(2),
      },
    });

  } catch (error) {
    console.error("Get current balance error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get current balance",
      error: error.message,
    });
  }
};


module.exports = {
  processPayment,
  processRechargePayment, // Add this

  paymentSuccess,
  paymentFail,
  paymentCancel,
  paymentIpn,

  rechargePaymentSuccess, // Add this
  rechargePaymentFail,    // Add this
  rechargePaymentCancel,  // Add this
  rechargePaymentIpn,     // Add this

  checkPaymentStatus,
  checkUserPayments,
    // New API endpoint for just balance

    getCurrentBalance
};














//! ATTENTION! Dont remove this code. 




    // const sslData = {
    //   total_amount: amount,
    //   currency: "BDT",
    //   tran_id: tran_id,
    //   success_url: `${frontendURL}/payment/success?tran_id=${tran_id}`, // Redirect to frontend success page
    //   fail_url: `${frontendURL}/payment/fail?tran_id=${tran_id}`, // Redirect to frontend fail page
    //   cancel_url: `${frontendURL}/payment/cancel?tran_id=${tran_id}`, // Redirect to frontend cancel page
    //   ipn_url: `${baseURL}/api/payment/ipn`, // IPN still goes to backend
    //   shipping_method: "No",
    //   product_name: "Account Activation Fee",
    //   product_category: "Service",
    //   product_profile: "general",
    //   cus_name: payload.fullName || "Customer",
    //   cus_email: payload.email || "customer@example.com",
    //   cus_add1: "Dhaka",
    //   cus_add2: "Dhaka",
    //   cus_city: "Dhaka",
    //   cus_state: "Dhaka",
    //   cus_postcode: "1000",
    //   cus_country: "Bangladesh",
    //   cus_phone: payload.mobileNo || "01700000000",
    //   cus_fax: payload.mobileNo || "01700000000",
    //   ship_name: payload.fullName || "Customer",
    //   ship_add1: "Dhaka",
    //   ship_add2: "Dhaka",
    //   ship_city: "Dhaka",
    //   ship_state: "Dhaka",
    //   ship_postcode: "1000",
    //   ship_country: "Bangladesh",
    // };