const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const Attendance = sequelize.define(
  "attendance",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    employeeId: {
      type: dt.INTEGER,
      allowNull: false,
      references: {
        model: "employees",
        key: "id",
      },
    },
    date: {
      type: dt.DATEONLY,
      allowNull: false,
    },
    status: {
      type: dt.ENUM("present", "absent", "late", "half-day"),
      allowNull: false,
      defaultValue: "absent",
    },
    checkIn: {
      type: dt.TIME,
      allowNull: true,
    },
    checkOut: {
      type: dt.TIME,
      allowNull: true,
    },
    checkInNote: {
      type: dt.TEXT,
      allowNull: true,
      comment: "Note added during check-in",
    },
    checkOutNote: {
      type: dt.TEXT,
      allowNull: true,
      comment: "Note added during check-out",
    },
    markedBy: {
      type: dt.INTEGER,
      allowNull: false,
      comment: "User ID who marked this attendance",
    },
    markedByRole: {
      type: dt.ENUM("admin", "employee"),
      allowNull: false,
      defaultValue: "employee",
    },
    overtime: {
      type: dt.FLOAT,
      allowNull: true,
      defaultValue: 0,
      comment: "Overtime in hours",
    },
    location: {
      type: dt.JSON,
      allowNull: true,
      comment: "Check-in location {lat, lng, address}",
    },
    ipAddress: {
      type: dt.STRING,
      allowNull: true,
    },
    deviceInfo: {
      type: dt.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "attendance",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["employeeId", "date"],
        name: "unique_employee_date",
      },
    ],
  }
);

module.exports = Attendance;