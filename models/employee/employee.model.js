// models/employee/employee.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const Employee = sequelize.define(
  "employee",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      unique: true,
      primaryKey: true,
    },
    employeeId: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
    },
    name: {
      type: dt.STRING,
      allowNull: false,
    },
    email: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    phone: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: dt.STRING,
      allowNull: false,
      defaultValue: "123456", // Default password for new employees
    },
    designation: {
      type: dt.STRING,
      allowNull: false,
    },
    department: {
      type: dt.STRING,
      allowNull: false,
    },
    joiningDate: {
      type: dt.DATEONLY,
      allowNull: false,
    },
    shift: {
      type: dt.ENUM('morning', 'evening', 'night'),
      allowNull: false,
      defaultValue: 'morning',
    },
    status: {
      type: dt.ENUM('active', 'inactive'),
      allowNull: false,
      defaultValue: 'active',
    },
    biometricId: {
      type: dt.STRING,
      allowNull: true,
      unique: true,
    },
    profileImage: {
      type: dt.STRING,
      allowNull: true,
    },
    address: {
      type: dt.TEXT,
      allowNull: true,
    },
    createdBy: {
      type: dt.INTEGER,
      allowNull: true,
      comment: 'User ID who created this employee',
    },
    updatedBy: {
      type: dt.INTEGER,
      allowNull: true,
      comment: 'User ID who last updated this employee',
    },
  },
  {
    tableName: "employees",
    timestamps: true,
  }
);

module.exports = Employee;