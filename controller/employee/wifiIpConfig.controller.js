const { Op } = require("sequelize");
const WifiIpConfig = require("../../models/employee/wifiIpConfig.model");

//! Helper function to transform response
const transformIpConfigResponse = (config) => {
  const configData = config.toJSON ? config.toJSON() : config;
  return configData;
};

//! Create new WiFi IP configuration
const createIpConfig = async (req, res, next) => {
  try {
    const { ipAddress, name, isActive } = req.body;
    const userId = req.user?.id;

    // Validate required fields
    if (!ipAddress || !name) {
      return res.status(400).json({
        success: false,
        message: "IP address and name are required!",
      });
    }

    // Check if IP already exists
    const existingIp = await WifiIpConfig.findOne({
      where: { ipAddress },
    });

    if (existingIp) {
      return res.status(409).json({
        success: false,
        message: "This IP address is already configured!",
      });
    }

    // Create new IP config
    const newConfig = await WifiIpConfig.create({
      ipAddress,
      name,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: userId,
      updatedBy: userId,
    });

    return res.status(201).json({
      success: true,
      message: "WiFi IP configuration created successfully!",
      data: transformIpConfigResponse(newConfig),
    });
  } catch (error) {
    console.error("Error creating IP config:", error);
    next(error);
  }
};

//! Get all WiFi IP configurations (with pagination and filtering)
const getAllIpConfigs = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      isActive,
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const whereClause = {};

    // Add search functionality
    if (search) {
      whereClause[Op.or] = [
        { ipAddress: { [Op.like]: `%${search}%` } },
        { name: { [Op.like]: `%${search}%` } },
      ];
    }

    // Add active status filter
    if (isActive !== undefined && isActive !== "") {
      whereClause.isActive = isActive === "true";
    }

    const { count, rows: configs } = await WifiIpConfig.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset: offset,
      order: [["createdAt", "DESC"]],
    });

    const transformedConfigs = configs.map(config => transformIpConfigResponse(config));

    const totalPages = Math.ceil(count / limitNumber);

    return res.status(200).json({
      success: true,
      message: "WiFi IP configurations retrieved successfully!",
      data: transformedConfigs,
      pagination: {
        totalItems: count,
        totalPages,
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting IP configs:", error);
    next(error);
  }
};

//! Get active WiFi IP configurations (for attendance verification)
const getActiveIpConfigs = async (req, res, next) => {
  try {
    const configs = await WifiIpConfig.findAll({
      where: { isActive: true },
      order: [["name", "ASC"]],
      attributes: ["id", "ipAddress", "name"],
    });

    return res.status(200).json({
      success: true,
      message: "Active WiFi IP configurations retrieved successfully!",
      data: configs,
    });
  } catch (error) {
    console.error("Error getting active IP configs:", error);
    next(error);
  }
};

//! Get WiFi IP configuration by ID
const getIpConfigById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const config = await WifiIpConfig.findByPk(id);

    if (!config) {
      return res.status(404).json({
        success: false,
        message: "WiFi IP configuration not found!",
      });
    }

    return res.status(200).json({
      success: true,
      message: "WiFi IP configuration retrieved successfully!",
      data: transformIpConfigResponse(config),
    });
  } catch (error) {
    console.error("Error getting IP config by ID:", error);
    next(error);
  }
};

//! Update WiFi IP configuration
const updateIpConfig = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { ipAddress, name, isActive } = req.body;
    const userId = req.user?.id;

    // Check if config exists
    const existingConfig = await WifiIpConfig.findByPk(id);
    if (!existingConfig) {
      return res.status(404).json({
        success: false,
        message: "WiFi IP configuration not found!",
      });
    }

    // Check if new IP address already exists (if changed)
    if (ipAddress && ipAddress !== existingConfig.ipAddress) {
      const ipExists = await WifiIpConfig.findOne({
        where: { ipAddress },
      });
      if (ipExists) {
        return res.status(409).json({
          success: false,
          message: "This IP address is already configured!",
        });
      }
    }

    // Update config
    await existingConfig.update({
      ipAddress: ipAddress || existingConfig.ipAddress,
      name: name || existingConfig.name,
      isActive: isActive !== undefined ? isActive : existingConfig.isActive,
      updatedBy: userId,
    });

    // Fetch updated config
    const updatedConfig = await WifiIpConfig.findByPk(id);

    return res.status(200).json({
      success: true,
      message: "WiFi IP configuration updated successfully!",
      data: transformIpConfigResponse(updatedConfig),
    });
  } catch (error) {
    console.error("Error updating IP config:", error);
    next(error);
  }
};

//! Delete WiFi IP configuration
const deleteIpConfig = async (req, res, next) => {
  try {
    const { id } = req.params;

    const config = await WifiIpConfig.findByPk(id);
    if (!config) {
      return res.status(404).json({
        success: false,
        message: "WiFi IP configuration not found!",
      });
    }

    await config.destroy();

    return res.status(200).json({
      success: true,
      message: "WiFi IP configuration deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting IP config:", error);
    next(error);
  }
};

//! Toggle IP configuration status (activate/deactivate)
const toggleIpConfigStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const userId = req.user?.id;

    if (isActive === undefined) {
      return res.status(400).json({
        success: false,
        message: "isActive status is required!",
      });
    }

    const config = await WifiIpConfig.findByPk(id);
    if (!config) {
      return res.status(404).json({
        success: false,
        message: "WiFi IP configuration not found!",
      });
    }

    await config.update({
      isActive,
      updatedBy: userId,
    });

    return res.status(200).json({
      success: true,
      message: `WiFi IP configuration ${isActive ? "activated" : "deactivated"} successfully!`,
      data: transformIpConfigResponse(config),
    });
  } catch (error) {
    console.error("Error toggling IP config status:", error);
    next(error);
  }
};

//! Bulk import WiFi IP configurations
const bulkImportIpConfigs = async (req, res, next) => {
  try {
    const { configs } = req.body;
    const userId = req.user?.id;

    if (!configs || !Array.isArray(configs) || configs.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid array of IP configurations!",
      });
    }

    const successful = [];
    const failed = [];

    for (const config of configs) {
      try {
        // Validate required fields
        if (!config.ipAddress || !config.name) {
          failed.push({
            data: config,
            reason: "IP address and name are required!",
          });
          continue;
        }

        // Check if IP already exists
        const existingIp = await WifiIpConfig.findOne({
          where: { ipAddress: config.ipAddress },
        });

        if (existingIp) {
          failed.push({
            data: config,
            reason: "IP address already exists",
          });
          continue;
        }

        // Create new config
        const newConfig = await WifiIpConfig.create({
          ipAddress: config.ipAddress,
          name: config.name,
          isActive: config.isActive !== undefined ? config.isActive : true,
          createdBy: userId,
          updatedBy: userId,
        });

        successful.push(transformIpConfigResponse(newConfig));
      } catch (error) {
        failed.push({
          data: config,
          reason: error.message || "Unknown error",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `${successful.length} IP configurations imported successfully, ${failed.length} failed.`,
      data: {
        successful,
        failed,
      },
    });
  } catch (error) {
    console.error("Error bulk importing IP configs:", error);
    next(error);
  }
};

//! Validate if an IP is in the configured list
const validateIp = async (req, res, next) => {
  try {
    const { ipAddress } = req.params;

    if (!ipAddress) {
      return res.status(400).json({
        success: false,
        message: "IP address is required!",
      });
    }

    const config = await WifiIpConfig.findOne({
      where: {
        ipAddress,
        isActive: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "IP validation completed!",
      data: {
        ipAddress,
        isValid: !!config,
        config: config ? {
          id: config.id,
          name: config.name,
        } : null,
      },
    });
  } catch (error) {
    console.error("Error validating IP:", error);
    next(error);
  }
};

//! Get IP configuration statistics
const getIpConfigStats = async (req, res, next) => {
  try {
    const totalConfigs = await WifiIpConfig.count();
    const activeConfigs = await WifiIpConfig.count({
      where: { isActive: true },
    });
    const inactiveConfigs = await WifiIpConfig.count({
      where: { isActive: false },
    });

    // Get recently added configs (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentlyAdded = await WifiIpConfig.count({
      where: {
        createdAt: {
          [Op.gte]: thirtyDaysAgo,
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "IP configuration statistics retrieved successfully!",
      data: {
        total: totalConfigs,
        active: activeConfigs,
        inactive: inactiveConfigs,
        recentlyAdded,
      },
    });
  } catch (error) {
    console.error("Error getting IP config stats:", error);
    next(error);
  }
};

module.exports = {
  createIpConfig,
  getAllIpConfigs,
  getActiveIpConfigs,
  getIpConfigById,
  updateIpConfig,
  deleteIpConfig,
  toggleIpConfigStatus,
  bulkImportIpConfigs,
  validateIp,
  getIpConfigStats,
};