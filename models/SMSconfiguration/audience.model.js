const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const Audience = sequelize.define(
  "Audience",
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
    },
    configId: {
      type: dt.INTEGER,
      allowNull: false,
    },
    phoneNumbers: {
      type: dt.TEXT,
      allowNull: false,
      defaultValue: "[]",
      get() {
        const rawValue = this.getDataValue('phoneNumbers');
        return rawValue ? JSON.parse(rawValue) : [];
      },
      set(value) {
        this.setDataValue('phoneNumbers', JSON.stringify(value || []));
      }
    },
    createdAt: {
      type: dt.DATE,
      allowNull: false,
      defaultValue: dt.NOW,
    },
    updatedAt: {
      type: dt.DATE,
      allowNull: false,
      defaultValue: dt.NOW,
    },
  },
  {
    tableName: 'audiences',
    timestamps: true,
    indexes: [
      {
        fields: ['clientId']
      },
      {
        fields: ['configId']
      }
    ]
  }
);

module.exports = Audience;