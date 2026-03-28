// models/SMSconfiguration/smsHistory.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const SMSHistory = sequelize.define(
  "sms_history",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      unique: true,
      primaryKey: true,
    },
    clientId: {
      type: dt.INTEGER,
      allowNull: false,
      references: {
        model: 'client-informations',
        key: 'id'
      }
    },
    configId: {
      type: dt.INTEGER,
      allowNull: false,
      references: {
        model: 'sms_configs',
        key: 'id'
      }
    },
    phoneNumber: {
      type: dt.STRING,
      allowNull: false,
    },
    message: {
      type: dt.TEXT,
      allowNull: false,
    },
    messageType: {
      type: dt.ENUM('config', 'custom'),
      allowNull: false,
      defaultValue: 'config'
    },
    gatewayMessageId: {
      type: dt.STRING,
      allowNull: true,
    },
    gatewayResponse: {
      type: dt.TEXT,
      allowNull: true,
    },
    status: {
      type: dt.ENUM('sent', 'failed', 'delivered', 'pending'),
      allowNull: false,
      defaultValue: 'sent'
    },
    sentAt: {
      type: dt.DATE,
      allowNull: false,
      defaultValue: dt.NOW
    },
    deliveryStatus: {
      type: dt.ENUM('pending', 'delivered', 'failed', 'unknown'),
      allowNull: false,
      defaultValue: 'pending'
    },
    deliveryConfirmedAt: {
      type: dt.DATE,
      allowNull: true,
    },
    cost: {
      type: dt.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0.00
    },
    characterCount: {
      type: dt.INTEGER,
      allowNull: false,
    },
    smsCount: {
      type: dt.INTEGER,
      allowNull: false,
      defaultValue: 1
    }
  },
  {
    tableName: "sms_history",
    timestamps: true,
    indexes: [
      {
        name: 'idx_client_id',
        fields: ['clientId']
      },
      {
        name: 'idx_config_id',
        fields: ['configId']
      },
      {
        name: 'idx_phone_number',
        fields: ['phoneNumber']
      },
      {
        name: 'idx_sent_at',
        fields: ['sentAt']
      },
      {
        name: 'idx_status',
        fields: ['status']
      }
    ]
  }
);

module.exports = SMSHistory;