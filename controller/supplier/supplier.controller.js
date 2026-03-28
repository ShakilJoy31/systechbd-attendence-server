const { Op } = require("sequelize");
const sequelize = require("../../database/connection");
const Supplier = require("../../models/supplier/supplier.model");


//! Helper function to transform supplier response
const transformSupplierResponse = (supplier) => {
  const supplierData = supplier.toJSON ? supplier.toJSON() : supplier;
  
  // Format timestamps
  if (supplierData.createdAt) {
    supplierData.joinedDate = new Date(supplierData.createdAt).toLocaleDateString('en-BD', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  
  if (supplierData.lastPurchaseDate) {
    supplierData.lastPurchaseDateFormatted = new Date(supplierData.lastPurchaseDate).toLocaleDateString('en-BD', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  
  // Parse productsSupplied if it's a string
  if (supplierData.productsSupplied && typeof supplierData.productsSupplied === 'string') {
    try {
      supplierData.productsSupplied = JSON.parse(supplierData.productsSupplied);
    } catch {
      supplierData.productsSupplied = supplierData.productsSupplied.split(',').map(item => item.trim());
    }
  }
  
  // Format credit limit
  if (supplierData.creditLimit) {
    supplierData.creditLimitFormatted = parseFloat(supplierData.creditLimit).toFixed(2);
  }
  
  // Format total purchase amount
  if (supplierData.totalPurchaseAmount) {
    supplierData.totalPurchaseAmountFormatted = parseFloat(supplierData.totalPurchaseAmount).toFixed(2);
  }
  
  // Add full name for display
  supplierData.displayName = supplierData.supplierName || supplierData.companyName;
  
  // Add rating stars representation
  if (supplierData.rating) {
    supplierData.ratingStars = "★".repeat(supplierData.rating) + "☆".repeat(5 - supplierData.rating);
  }
  
  return supplierData;
};

//! Create new supplier
const createSupplier = async (req, res, next) => {
  try {
    const {
      // Basic Information
      supplierName,
      supplierType,
      
      // Company Information
      companyName,
      tradeLicenseNo,
      binNo,
      tinNo,
      
      // Contact Person Information
      contactPersonName,
      contactPersonDesignation,
      contactPersonPhoto,
      contactPersonNidOrPassportNo,
      
      // Contact Information
      phoneNo,
      alternatePhoneNo,
      email,
      website,
      
      // Address
      address,
      city,
      state,
      postalCode,
      country = "Bangladesh",
      
      // Business Details
      productsSupplied,
      yearOfEstablishment,
      paymentTerms,
      creditLimit,
      
      // Bank Details
      bankName,
      bankAccountNo,
      bankBranch,
      bankAccountHolderName,
      routingNumber,
      
      // Documents
      documents = {},
      
      // System Fields
      status = "active",
      rating = 3,
      notes,
      
      // Metadata
      createdBy,
    } = req.body;

    // Validate required fields
    if (!supplierName || !companyName || !contactPersonName || !phoneNo || !email || !address || !city || !state) {
      return res.status(400).json({
        success: false,
        message: "Supplier name, company name, contact person name, phone number, email, and address are required!",
      });
    }

    // Check if email already exists
    const emailExists = await Supplier.findOne({ where: { email } });
    if (emailExists) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered!",
      });
    }

    // Check if phone already exists
    const phoneExists = await Supplier.findOne({ where: { phoneNo } });
    if (phoneExists) {
      return res.status(409).json({
        success: false,
        message: "This phone number is already registered!",
      });
    }

    // Check if trade license exists (if provided)
    if (tradeLicenseNo) {
      const licenseExists = await Supplier.findOne({ where: { tradeLicenseNo } });
      if (licenseExists) {
        return res.status(409).json({
          success: false,
          message: "This trade license number is already registered!",
        });
      }
    }

    // Process productsSupplied if it's an array
    let processedProductsSupplied = productsSupplied;
    if (Array.isArray(productsSupplied)) {
      processedProductsSupplied = JSON.stringify(productsSupplied);
    }

    // Create new supplier
    const newSupplier = await Supplier.create({
      // Basic Information
      supplierName,
      supplierType: supplierType || "manufacturer",
      
      // Company Information
      companyName,
      tradeLicenseNo: tradeLicenseNo || null,
      binNo: binNo || null,
      tinNo: tinNo || null,
      
      // Contact Person Information
      contactPersonName,
      contactPersonDesignation: contactPersonDesignation || null,
      contactPersonPhoto: contactPersonPhoto || null,
      contactPersonNidOrPassportNo: contactPersonNidOrPassportNo || null,
      
      // Contact Information
      phoneNo,
      alternatePhoneNo: alternatePhoneNo || null,
      email,
      website: website || null,
      
      // Address
      address,
      city,
      state,
      postalCode: postalCode || null,
      country,
      
      // Business Details
      productsSupplied: processedProductsSupplied || null,
      yearOfEstablishment: yearOfEstablishment ? parseInt(yearOfEstablishment) : null,
      paymentTerms: paymentTerms || "immediate",
      creditLimit: creditLimit ? parseFloat(creditLimit) : 0.00,
      
      // Bank Details
      bankName: bankName || null,
      bankAccountNo: bankAccountNo || null,
      bankBranch: bankBranch || null,
      bankAccountHolderName: bankAccountHolderName || null,
      routingNumber: routingNumber || null,
      
      // Documents
      documents: documents || {},
      
      // System Fields
      status,
      rating: rating ? parseInt(rating) : 3,
      notes: notes || null,
      
      // Statistics
      totalPurchases: 0,
      totalPurchaseAmount: 0.00,
      
      // Metadata
      createdBy: createdBy || null,
    });

    // Transform response
    const supplierData = transformSupplierResponse(newSupplier);

    return res.status(201).json({
      success: true,
      message: "Supplier created successfully!",
      data: supplierData,
    });
  } catch (error) {
    console.error("Error creating supplier:", error);
    next(error);
  }
};

//! Get all suppliers with pagination and filtering
const getAllSuppliers = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "",
      city = "",
      supplierType = "",
      rating = "",
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const whereClause = {};

    // Add search functionality
    if (search) {
      whereClause[Op.or] = [
        { supplierName: { [Op.like]: `%${search}%` } },
        { companyName: { [Op.like]: `%${search}%` } },
        { contactPersonName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phoneNo: { [Op.like]: `%${search}%` } },
        { tradeLicenseNo: { [Op.like]: `%${search}%` } },
      ];
    }

    // Add status filter
    if (status) {
      whereClause.status = status;
    }

    // Add city filter
    if (city) {
      whereClause.city = { [Op.like]: `%${city}%` };
    }

    // Add supplier type filter
    if (supplierType) {
      whereClause.supplierType = supplierType;
    }

    // Add rating filter
    if (rating) {
      whereClause.rating = parseInt(rating);
    }

    const { count, rows: suppliers } = await Supplier.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset: offset,
      order: [[sortBy, sortOrder]],
    });

    // Transform each supplier
    const transformedSuppliers = suppliers.map(supplier => 
      transformSupplierResponse(supplier)
    );

    const totalPages = Math.ceil(count / limitNumber);

    return res.status(200).json({
      success: true,
      message: "Suppliers retrieved successfully!",
      data: transformedSuppliers,
      pagination: {
        totalItems: count,
        totalPages: totalPages,
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting suppliers:", error);
    next(error);
  }
};

//! Get supplier by ID
const getSupplierById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const supplier = await Supplier.findOne({
      where: { id },
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found!",
      });
    }

    // Transform response
    const supplierData = transformSupplierResponse(supplier);

    return res.status(200).json({
      success: true,
      message: "Supplier retrieved successfully!",
      data: supplierData,
    });
  } catch (error) {
    console.error("Error getting supplier by ID:", error);
    next(error);
  }
};

//! Update supplier
const updateSupplier = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if supplier exists
    const existingSupplier = await Supplier.findOne({ where: { id } });
    if (!existingSupplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found!",
      });
    }

    // Check if new email already exists (if changed)
    if (updateData.email && updateData.email !== existingSupplier.email) {
      const emailExists = await Supplier.findOne({ 
        where: { email: updateData.email } 
      });
      if (emailExists) {
        return res.status(409).json({
          success: false,
          message: "This email is already registered!",
        });
      }
    }

    // Check if new phone already exists (if changed)
    if (updateData.phoneNo && updateData.phoneNo !== existingSupplier.phoneNo) {
      const phoneExists = await Supplier.findOne({ 
        where: { phoneNo: updateData.phoneNo } 
      });
      if (phoneExists) {
        return res.status(409).json({
          success: false,
          message: "This phone number is already registered!",
        });
      }
    }

    // Check if new trade license already exists (if changed)
    if (updateData.tradeLicenseNo && updateData.tradeLicenseNo !== existingSupplier.tradeLicenseNo) {
      const licenseExists = await Supplier.findOne({ 
        where: { tradeLicenseNo: updateData.tradeLicenseNo } 
      });
      if (licenseExists) {
        return res.status(409).json({
          success: false,
          message: "This trade license number is already registered!",
        });
      }
    }

    // Parse numeric fields
    if (updateData.yearOfEstablishment) {
      updateData.yearOfEstablishment = parseInt(updateData.yearOfEstablishment);
    }
    if (updateData.rating) {
      updateData.rating = parseInt(updateData.rating);
    }
    if (updateData.creditLimit) {
      updateData.creditLimit = parseFloat(updateData.creditLimit);
    }

    // Process productsSupplied if it's an array
    if (updateData.productsSupplied && Array.isArray(updateData.productsSupplied)) {
      updateData.productsSupplied = JSON.stringify(updateData.productsSupplied);
    }

    // Add updatedBy metadata
    updateData.updatedBy = req.user?.id || null;

    // Perform update
    await Supplier.update(updateData, {
      where: { id },
    });

    // Fetch updated supplier
    const updatedSupplier = await Supplier.findOne({
      where: { id },
    });

    // Transform response
    const supplierData = transformSupplierResponse(updatedSupplier);

    return res.status(200).json({
      success: true,
      message: "Supplier updated successfully!",
      data: supplierData,
    });
  } catch (error) {
    console.error("Error updating supplier:", error);
    next(error);
  }
};

//! Delete supplier
const deleteSupplier = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existingSupplier = await Supplier.findOne({ where: { id } });

    if (!existingSupplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found!",
      });
    }

    await Supplier.destroy({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Supplier deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting supplier:", error);
    next(error);
  }
};

//! Update supplier status
const updateSupplierStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const supplier = await Supplier.findOne({ where: { id } });
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found!",
      });
    }

    await Supplier.update(
      { status, updatedBy: req.user?.id || null }, 
      { where: { id } }
    );

    // Fetch updated supplier
    const updatedSupplier = await Supplier.findOne({
      where: { id },
    });

    // Transform response
    const supplierData = transformSupplierResponse(updatedSupplier);

    return res.status(200).json({
      success: true,
      message: `Supplier status updated to ${status} successfully!`,
      data: supplierData,
    });
  } catch (error) {
    console.error("Error updating supplier status:", error);
    next(error);
  }
};

//! Update supplier rating
const updateSupplierRating = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating } = req.body;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5!",
      });
    }

    const supplier = await Supplier.findOne({ where: { id } });
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found!",
      });
    }

    await Supplier.update(
      { rating: parseInt(rating), updatedBy: req.user?.id || null }, 
      { where: { id } }
    );

    // Fetch updated supplier
    const updatedSupplier = await Supplier.findOne({
      where: { id },
    });

    // Transform response
    const supplierData = transformSupplierResponse(updatedSupplier);

    return res.status(200).json({
      success: true,
      message: `Supplier rating updated to ${rating} successfully!`,
      data: supplierData,
    });
  } catch (error) {
    console.error("Error updating supplier rating:", error);
    next(error);
  }
};

//! Bulk import suppliers
const bulkImportSuppliers = async (req, res, next) => {
  try {
    const { suppliers } = req.body;

    if (!suppliers || !Array.isArray(suppliers) || suppliers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of suppliers!",
      });
    }

    const results = {
      successful: [],
      failed: [],
    };

    // Process each supplier
    for (const supplierData of suppliers) {
      try {
        // Validate required fields
        if (!supplierData.supplierName || !supplierData.companyName || !supplierData.contactPersonName || 
            !supplierData.phoneNo || !supplierData.email || !supplierData.address || 
            !supplierData.city || !supplierData.state) {
          results.failed.push({
            data: supplierData,
            reason: "Missing required fields",
          });
          continue;
        }

        // Check for duplicates
        const emailExists = await Supplier.findOne({ where: { email: supplierData.email } });
        if (emailExists) {
          results.failed.push({
            data: supplierData,
            reason: "Email already exists",
          });
          continue;
        }

        const phoneExists = await Supplier.findOne({ where: { phoneNo: supplierData.phoneNo } });
        if (phoneExists) {
          results.failed.push({
            data: supplierData,
            reason: "Phone number already exists",
          });
          continue;
        }

        // Process productsSupplied if needed
        if (supplierData.productsSupplied && Array.isArray(supplierData.productsSupplied)) {
          supplierData.productsSupplied = JSON.stringify(supplierData.productsSupplied);
        }

        // Create supplier
        const newSupplier = await Supplier.create({
          ...supplierData,
          createdBy: req.user?.id || null,
        });

        results.successful.push(transformSupplierResponse(newSupplier));
      } catch (error) {
        results.failed.push({
          data: supplierData,
          reason: error.message,
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: `Bulk import completed: ${results.successful.length} successful, ${results.failed.length} failed`,
      data: results,
    });
  } catch (error) {
    console.error("Error bulk importing suppliers:", error);
    next(error);
  }
};

//! Get supplier statistics
const getSupplierStats = async (req, res, next) => {
  try {
    const totalSuppliers = await Supplier.count();
    const activeSuppliers = await Supplier.count({
      where: { status: "active" },
    });
    const inactiveSuppliers = await Supplier.count({
      where: { status: "inactive" },
    });
    const blacklistedSuppliers = await Supplier.count({
      where: { status: "blacklisted" },
    });

    // Count by city
    const byCity = await Supplier.findAll({
      attributes: [
        "city",
        [sequelize.fn("COUNT", sequelize.col("city")), "count"],
      ],
      group: ["city"],
      where: { status: "active" },
    });

    // Count by supplier type
    const byType = await Supplier.findAll({
      attributes: [
        "supplierType",
        [sequelize.fn("COUNT", sequelize.col("supplierType")), "count"],
      ],
      group: ["supplierType"],
      where: { status: "active" },
    });

    // Average rating
    const avgRating = await Supplier.findOne({
      attributes: [
        [sequelize.fn("AVG", sequelize.col("rating")), "averageRating"],
      ],
      where: { status: "active" },
    });

    // Total purchase amount
    const totalPurchaseAmount = await Supplier.findOne({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("totalPurchaseAmount")), "totalPurchaseAmount"],
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Supplier statistics retrieved successfully!",
      data: {
        total: totalSuppliers,
        active: activeSuppliers,
        inactive: inactiveSuppliers,
        blacklisted: blacklistedSuppliers,
        averageRating: parseFloat(avgRating?.dataValues?.averageRating || 0).toFixed(2),
        totalPurchaseAmount: parseFloat(totalPurchaseAmount?.dataValues?.totalPurchaseAmount || 0).toFixed(2),
        byCity,
        byType,
      },
    });
  } catch (error) {
    console.error("Error getting supplier stats:", error);
    next(error);
  }
};

//! Search suppliers (for dropdown/autocomplete)
const searchSuppliers = async (req, res, next) => {
  try {
    const { q = "", limit = 20 } = req.query;

    const suppliers = await Supplier.findAll({
      where: {
        [Op.or]: [
          { supplierName: { [Op.like]: `%${q}%` } },
          { companyName: { [Op.like]: `%${q}%` } },
          { contactPersonName: { [Op.like]: `%${q}%` } },
          { phoneNo: { [Op.like]: `%${q}%` } },
          { email: { [Op.like]: `%${q}%` } },
        ],
        status: "active",
      },
      limit: parseInt(limit),
      attributes: ["id", "supplierName", "companyName", "contactPersonName", "phoneNo", "email", "city"],
    });

    const transformedSuppliers = suppliers.map(supplier => ({
      id: supplier.id,
      name: supplier.supplierName,
      companyName: supplier.companyName,
      contactPerson: supplier.contactPersonName,
      phone: supplier.phoneNo,
      email: supplier.email,
      city: supplier.city,
      displayName: `${supplier.supplierName} (${supplier.companyName})`,
    }));

    return res.status(200).json({
      success: true,
      message: "Suppliers retrieved successfully!",
      data: transformedSuppliers,
    });
  } catch (error) {
    console.error("Error searching suppliers:", error);
    next(error);
  }
};

module.exports = {
  createSupplier,
  getAllSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
  updateSupplierStatus,
  updateSupplierRating,
  bulkImportSuppliers,
  getSupplierStats,
  searchSuppliers,
};