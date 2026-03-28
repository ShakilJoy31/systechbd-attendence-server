const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const Supplier = sequelize.define(
  "supplier",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      unique: true,
      primaryKey: true,
    },
    // Basic Information
    supplierName: {
      type: dt.STRING,
      allowNull: false,
    },
    supplierType: {
      type: dt.STRING,
      allowNull: true,
      defaultValue: "manufacturer", // manufacturer, distributor, wholesaler, retailer
    },
    
    // Company Information
    companyName: {
      type: dt.STRING,
      allowNull: false,
    },
    tradeLicenseNo: {
      type: dt.STRING,
      allowNull: true,
      unique: true,
    },
    binNo: {
      type: dt.STRING,
      allowNull: true,
    },
    tinNo: {
      type: dt.STRING,
      allowNull: true,
    },
    
    // Contact Person Information
    contactPersonName: {
      type: dt.STRING,
      allowNull: false,
    },
    contactPersonDesignation: {
      type: dt.STRING,
      allowNull: true,
    },
    contactPersonPhoto: {
      type: dt.STRING,
      allowNull: true,
    },
    contactPersonNidOrPassportNo: {
      type: dt.STRING,
      allowNull: true,
    },
    
    // Contact Information
    phoneNo: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
    },
    alternatePhoneNo: {
      type: dt.STRING,
      allowNull: true,
    },
    email: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
    },
    website: {
      type: dt.STRING,
      allowNull: true,
    },
    
    // Address
    address: {
      type: dt.TEXT,
      allowNull: false,
    },
    city: {
      type: dt.STRING,
      allowNull: false,
    },
    state: {
      type: dt.STRING,
      allowNull: false,
    },
    postalCode: {
      type: dt.STRING,
      allowNull: true,
    },
    country: {
      type: dt.STRING,
      allowNull: false,
      defaultValue: "Bangladesh",
    },
    
    // Business Details
    productsSupplied: {
      type: dt.TEXT, // Comma separated or JSON string of product categories
      allowNull: true,
    },
    yearOfEstablishment: {
      type: dt.INTEGER,
      allowNull: true,
    },
    paymentTerms: {
      type: dt.STRING,
      allowNull: true,
      defaultValue: "immediate", // immediate, 7days, 15days, 30days, 45days, 60days
    },
    creditLimit: {
      type: dt.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0.00,
    },
    
    // Bank Details
    bankName: {
      type: dt.STRING,
      allowNull: true,
    },
    bankAccountNo: {
      type: dt.STRING,
      allowNull: true,
    },
    bankBranch: {
      type: dt.STRING,
      allowNull: true,
    },
    bankAccountHolderName: {
      type: dt.STRING,
      allowNull: true,
    },
    routingNumber: {
      type: dt.STRING,
      allowNull: true,
    },
    
    // Documents
    documents: {
      type: dt.JSON, // Store document URLs and metadata
      allowNull: true,
      defaultValue: {},
    },
    
    // System Fields
    status: {
      type: dt.STRING,
      allowNull: false,
      defaultValue: "active", // active, inactive, blacklisted
    },
    rating: {
      type: dt.INTEGER,
      allowNull: true,
      defaultValue: 3, // 1-5 rating
      validate: {
        min: 1,
        max: 5,
      },
    },
    notes: {
      type: dt.TEXT,
      allowNull: true,
    },
    
    // Statistics (updated via triggers/queries)
    totalPurchases: {
      type: dt.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    totalPurchaseAmount: {
      type: dt.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0.00,
    },
    lastPurchaseDate: {
      type: dt.DATE,
      allowNull: true,
    },
    
    // Metadata
    createdBy: {
      type: dt.INTEGER,
      allowNull: true,
      comment: "User ID who created this supplier",
    },
    updatedBy: {
      type: dt.INTEGER,
      allowNull: true,
      comment: "User ID who last updated this supplier",
    },
  },
  {
    tableName: "suppliers-collections",
    timestamps: true,
    indexes: [
      {
        unique: false,
        fields: ["companyName"],
      },
      {
        unique: false,
        fields: ["city"],
      },
      {
        unique: false,
        fields: ["status"],
      },
    ],
  }
);

module.exports = Supplier;