const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const ClientInformation = sequelize.define(
  "client-information",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      unique: true,
      primaryKey: true,
    },
    fullName: {
      type: dt.STRING,
      allowNull: false,
    },
    photo: {
      type: dt.STRING,
      allowNull: true,
    },
    dateOfBirth: {
      type: dt.DATE,
      allowNull: true,
    },
    age: {
      type: dt.INTEGER,
      allowNull: true,
    },
    sex: {
      type: dt.STRING,
      allowNull: true,
    },
    nidOrPassportNo: {
      type: dt.STRING,
      allowNull: true,
    },
    // New fields for NID photos
    nidPhotoFrontSide: {
      type: dt.STRING,
      allowNull: true,
      defaultValue: "",
    },
    nidPhotoBackSide: {
      type: dt.STRING,
      allowNull: true,
      defaultValue: "",
    },
    mobileNo: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
    },
    email: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
    },
    role: {
      type: dt.STRING,
      allowNull: false,
      defaultValue: "client",
    },
    status: {
      type: dt.STRING,
      allowNull: false,
      defaultValue: "pending", //! pending, active, inactive
    },
    password: {
      type: dt.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "client-informations",
    timestamps: true,
  }
);

module.exports = ClientInformation;
