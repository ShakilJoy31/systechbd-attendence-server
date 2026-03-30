const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const WifiIpConfig = sequelize.define(
  "wifiIpConfig",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    ipAddress: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isIP: true,
      },
    },
    name: {
      type: dt.STRING,
      allowNull: false,
      comment: "Friendly name for this IP/location (e.g., 'Main Office', 'Branch Office')",
    },
    isActive: {
      type: dt.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    createdBy: {
      type: dt.INTEGER,
      allowNull: true,
      comment: "User ID who created this config",
    },
    updatedBy: {
      type: dt.INTEGER,
      allowNull: true,
      comment: "User ID who last updated this config",
    },
  },
  {
    tableName: "wifi_ip_configs",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["ipAddress"],
        name: "unique_ip_address",
      },
      {
        fields: ["isActive"],
        name: "idx_active_ips",
      },
    ],
  }
);

module.exports = WifiIpConfig;