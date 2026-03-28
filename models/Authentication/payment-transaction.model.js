const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const PaymentTransaction = sequelize.define(
  "payment-transaction",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: dt.INTEGER,
      allowNull: false,
    },
    transactionId: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
    },
    valId: {
      type: dt.STRING,
      allowNull: true,
    },
    amount: {
      type: dt.DECIMAL(10, 2),
      allowNull: false,
    },
    currency: {
      type: dt.STRING,
      defaultValue: 'BDT',
    },
    status: {
      type: dt.ENUM('pending', 'completed', 'failed', 'cancelled'),
      defaultValue: 'pending',
    },
    paymentMethod: {
      type: dt.STRING,
      allowNull: true,
    },
    cardType: {
      type: dt.STRING,
      allowNull: true,
    },
    cardNo: {
      type: dt.STRING,
      allowNull: true,
    },
    cardIssuer: {
      type: dt.STRING,
      allowNull: true,
    },
    cardBrand: {
      type: dt.STRING,
      allowNull: true,
    },
    bankTransactionId: {
      type: dt.STRING,
      allowNull: true,
    },
    currencyAmount: {
      type: dt.DECIMAL(10, 2),
      allowNull: true,
    },
    currencyRate: {
      type: dt.DECIMAL(10, 4),
      allowNull: true,
    },
    riskLevel: {
      type: dt.STRING,
      allowNull: true,
    },
    riskTitle: {
      type: dt.STRING,
      allowNull: true,
    },
    userData: {
      type: dt.JSON,
      allowNull: true,
    },
    errorMessage: {
      type: dt.TEXT,
      allowNull: true,
    },
    completedAt: {
      type: dt.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "payment-transactions",
    timestamps: true,
  }
);

module.exports = PaymentTransaction;