const express = require('express');
const { processPayment, paymentSuccess, paymentFail, paymentCancel, paymentIpn, checkPaymentStatus, checkUserPayments, processRechargePayment, rechargePaymentSuccess, rechargePaymentFail, rechargePaymentCancel, rechargePaymentIpn, getCurrentBalance } = require('../controller/auth/payment.controller');
const router = express.Router();

router.post('/process-payment', processPayment);
router.post('/success', paymentSuccess);
router.post('/fail', paymentFail);
router.post('/cancel', paymentCancel);
router.post('/ipn', paymentIpn);


router.get('/status/:tran_id', checkPaymentStatus);           // Check by transaction ID
router.get('/user/:userId', checkUserPayments);               // Check all transactions for a user (optional)




router.post("/process-recharge", processRechargePayment);
router.post('/recharge-success', rechargePaymentSuccess);
router.post('/recharge-fail', rechargePaymentFail);
router.post('/recharge-cancel', rechargePaymentCancel);
router.post('/recharge-ipn', rechargePaymentIpn);


router.get("/client-balance/:userId", getCurrentBalance)


module.exports = router;