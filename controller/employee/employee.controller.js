// controller/employee/employee.controller.js
const { Op } = require("sequelize");
const sequelize = require("../../database/connection");
const Employee = require("../../models/employee/employee.model");

//! Helper function to transform employee response
const transformEmployeeResponse = (employee) => {
  const employeeData = employee.toJSON ? employee.toJSON() : employee;
  
  // Format timestamps
  if (employeeData.createdAt) {
    employeeData.joinedDate = new Date(employeeData.createdAt).toLocaleDateString('en-BD', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  
  return employeeData;
};

//! Generate unique employee ID
const generateEmployeeId = async () => {
  const prefix = "EMP";
  const year = new Date().getFullYear();
  const count = await Employee.count();
  const sequence = (count + 1).toString().padStart(4, '0');
  return `${prefix}${year}${sequence}`;
};

//! Create new employee
const createEmployee = async (req, res, next) => {
  try {
    const {
      employeeId,
      name,
      email,
      phone,
      designation,
      department,
      joiningDate,
      shift,
      status = "active",
      biometricId,
      profileImage,
      address,
    } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !designation || !department || !joiningDate) {
      return res.status(400).json({
        success: false,
        message: "Name, email, phone, designation, department, and joining date are required!",
      });
    }

    // Check if email already exists
    const emailExists = await Employee.findOne({ where: { email } });
    if (emailExists) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered!",
      });
    }

    // Check if phone already exists
    const phoneExists = await Employee.findOne({ where: { phone } });
    if (phoneExists) {
      return res.status(409).json({
        success: false,
        message: "This phone number is already registered!",
      });
    }

    // Check if biometric ID already exists (if provided)
    if (biometricId) {
      const biometricExists = await Employee.findOne({ where: { biometricId } });
      if (biometricExists) {
        return res.status(409).json({
          success: false,
          message: "This biometric ID is already assigned to another employee!",
        });
      }
    }

    // Generate employee ID if not provided
    const finalEmployeeId = employeeId || await generateEmployeeId();

    // Check if employee ID already exists
    const employeeIdExists = await Employee.findOne({ where: { employeeId: finalEmployeeId } });
    if (employeeIdExists) {
      return res.status(409).json({
        success: false,
        message: "This employee ID is already in use!",
      });
    }

    // Create new employee
    const newEmployee = await Employee.create({
      employeeId: finalEmployeeId,
      name,
      email,
      phone,
      designation,
      department,
      joiningDate,
      shift: shift || "morning",
      status,
      biometricId: biometricId || null,
      profileImage: profileImage || null,
      address: address || null,
      createdBy: req.user?.id || null,
    });

    // Transform response
    const employeeData = transformEmployeeResponse(newEmployee);

    return res.status(201).json({
      success: true,
      message: "Employee created successfully!",
      data: employeeData,
    });
  } catch (error) {
    console.error("Error creating employee:", error);
    next(error);
  }
};

//! Get all employees with pagination and filtering
const getAllEmployees = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "",
      department = "",
      shift = "",
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const whereClause = {};

    // Add search functionality
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { employeeId: { [Op.like]: `%${search}%` } },
        { designation: { [Op.like]: `%${search}%` } },
      ];
    }

    // Add status filter
    if (status) {
      whereClause.status = status;
    }

    // Add department filter
    if (department) {
      whereClause.department = department;
    }

    // Add shift filter
    if (shift) {
      whereClause.shift = shift;
    }

    const { count, rows: employees } = await Employee.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset: offset,
      order: [["createdAt", "DESC"]],
    });

    // Transform each employee
    const transformedEmployees = employees.map(employee => 
      transformEmployeeResponse(employee)
    );

    const totalPages = Math.ceil(count / limitNumber);

    return res.status(200).json({
      success: true,
      message: "Employees retrieved successfully!",
      data: transformedEmployees,
      pagination: {
        totalItems: count,
        totalPages: totalPages,
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting employees:", error);
    next(error);
  }
};

//! Get employee by ID
const getEmployeeById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const employee = await Employee.findOne({
      where: { id },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found!",
      });
    }

    // Transform response
    const employeeData = transformEmployeeResponse(employee);

    return res.status(200).json({
      success: true,
      message: "Employee retrieved successfully!",
      data: employeeData,
    });
  } catch (error) {
    console.error("Error getting employee by ID:", error);
    next(error);
  }
};

//! Update employee
const updateEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if employee exists
    const existingEmployee = await Employee.findOne({ where: { id } });
    if (!existingEmployee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found!",
      });
    }

    // Check if new email already exists (if changed)
    if (updateData.email && updateData.email !== existingEmployee.email) {
      const emailExists = await Employee.findOne({ 
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
    if (updateData.phone && updateData.phone !== existingEmployee.phone) {
      const phoneExists = await Employee.findOne({ 
        where: { phone: updateData.phone } 
      });
      if (phoneExists) {
        return res.status(409).json({
          success: false,
          message: "This phone number is already registered!",
        });
      }
    }

    // Check if new biometric ID already exists (if changed)
    if (updateData.biometricId && updateData.biometricId !== existingEmployee.biometricId) {
      const biometricExists = await Employee.findOne({ 
        where: { biometricId: updateData.biometricId } 
      });
      if (biometricExists) {
        return res.status(409).json({
          success: false,
          message: "This biometric ID is already assigned to another employee!",
        });
      }
    }

    // Check if new employee ID already exists (if changed)
    if (updateData.employeeId && updateData.employeeId !== existingEmployee.employeeId) {
      const employeeIdExists = await Employee.findOne({ 
        where: { employeeId: updateData.employeeId } 
      });
      if (employeeIdExists) {
        return res.status(409).json({
          success: false,
          message: "This employee ID is already in use!",
        });
      }
    }

    // Add updated by info
    updateData.updatedBy = req.user?.id || null;

    // Perform update
    await Employee.update(updateData, {
      where: { id },
    });

    // Fetch updated employee
    const updatedEmployee = await Employee.findOne({
      where: { id },
    });

    // Transform response
    const employeeData = transformEmployeeResponse(updatedEmployee);

    return res.status(200).json({
      success: true,
      message: "Employee updated successfully!",
      data: employeeData,
    });
  } catch (error) {
    console.error("Error updating employee:", error);
    next(error);
  }
};

//! Delete employee
const deleteEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existingEmployee = await Employee.findOne({ where: { id } });

    if (!existingEmployee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found!",
      });
    }

    await Employee.destroy({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Employee deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting employee:", error);
    next(error);
  }
};

//! Update employee status
const updateEmployeeStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Valid status (active/inactive) is required!",
      });
    }

    const employee = await Employee.findOne({ where: { id } });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found!",
      });
    }

    await Employee.update(
      { 
        status, 
        updatedBy: req.user?.id || null 
      }, 
      { where: { id } }
    );

    // Fetch updated employee
    const updatedEmployee = await Employee.findOne({
      where: { id },
    });

    // Transform response
    const employeeData = transformEmployeeResponse(updatedEmployee);

    return res.status(200).json({
      success: true,
      message: `Employee ${status === 'active' ? 'activated' : 'deactivated'} successfully!`,
      data: employeeData,
    });
  } catch (error) {
    console.error("Error updating employee status:", error);
    next(error);
  }
};

//! Bulk import employees
const bulkImportEmployees = async (req, res, next) => {
  try {
    const { employees } = req.body;

    if (!employees || !Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid array of employees!",
      });
    }

    const successful = [];
    const failed = [];

    for (const employee of employees) {
      try {
        // Validate required fields
        if (!employee.name || !employee.email || !employee.phone || !employee.designation || !employee.department || !employee.joiningDate) {
          failed.push({
            data: employee,
            reason: "Missing required fields (name, email, phone, designation, department, joiningDate)",
          });
          continue;
        }

        // Check if email exists
        const emailExists = await Employee.findOne({ where: { email: employee.email } });
        if (emailExists) {
          failed.push({
            data: employee,
            reason: "Email already exists",
          });
          continue;
        }

        // Check if phone exists
        const phoneExists = await Employee.findOne({ where: { phone: employee.phone } });
        if (phoneExists) {
          failed.push({
            data: employee,
            reason: "Phone number already exists",
          });
          continue;
        }

        // Generate employee ID
        const employeeId = await generateEmployeeId();

        // Create employee
        const newEmployee = await Employee.create({
          employeeId,
          name: employee.name,
          email: employee.email,
          phone: employee.phone,
          designation: employee.designation,
          department: employee.department,
          joiningDate: employee.joiningDate,
          shift: employee.shift || "morning",
          status: employee.status || "active",
          biometricId: employee.biometricId || null,
          profileImage: employee.profileImage || null,
          address: employee.address || null,
          createdBy: req.user?.id || null,
        });

        successful.push(transformEmployeeResponse(newEmployee));
      } catch (error) {
        failed.push({
          data: employee,
          reason: error.message || "Unknown error",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `${successful.length} employees imported successfully, ${failed.length} failed.`,
      data: {
        successful,
        failed,
      },
    });
  } catch (error) {
    console.error("Error bulk importing employees:", error);
    next(error);
  }
};

//! Get employee statistics
const getEmployeeStats = async (req, res, next) => {
  try {
    const totalEmployees = await Employee.count();
    const activeEmployees = await Employee.count({
      where: { status: "active" },
    });
    const inactiveEmployees = await Employee.count({
      where: { status: "inactive" },
    });

    // Get employees by department
    const byDepartment = await Employee.findAll({
      attributes: [
        "department",
        [sequelize.fn("COUNT", sequelize.col("department")), "count"],
      ],
      group: ["department"],
    });

    // Get employees by shift
    const byShift = await Employee.findAll({
      attributes: [
        "shift",
        [sequelize.fn("COUNT", sequelize.col("shift")), "count"],
      ],
      group: ["shift"],
    });

    // Get employees joined this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const joinedThisMonth = await Employee.count({
      where: {
        joiningDate: {
          [Op.gte]: startOfMonth,
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Employee statistics retrieved successfully!",
      data: {
        total: totalEmployees,
        active: activeEmployees,
        inactive: inactiveEmployees,
        joinedThisMonth,
        byDepartment,
        byShift,
      },
    });
  } catch (error) {
    console.error("Error getting employee stats:", error);
    next(error);
  }
};

//! Search employees (for dropdown/autocomplete)
const searchEmployees = async (req, res, next) => {
  try {
    const { q = "", limit = 20 } = req.query;

    const whereClause = {};
    
    if (q) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${q}%` } },
        { employeeId: { [Op.like]: `%${q}%` } },
        { email: { [Op.like]: `%${q}%` } },
      ];
    }

    const employees = await Employee.findAll({
      where: whereClause,
      limit: parseInt(limit, 10),
      order: [["name", "ASC"]],
      attributes: ["id", "employeeId", "name", "email", "designation", "department", "profileImage", "status"],
    });

    return res.status(200).json({
      success: true,
      message: "Employees retrieved successfully!",
      data: employees,
    });
  } catch (error) {
    console.error("Error searching employees:", error);
    next(error);
  }
};


// controller/employee/employee.controller.js - Add this function

//! Change employee password (Simplified version)
const changeEmployeePassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    // Validate required fields
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: "All password fields are required!",
      });
    }

    // Check if new password matches confirm password
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirm password do not match!",
      });
    }

    // Check if new password is different from current password
    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password!",
      });
    }

    // Check if employee exists
    const employee = await Employee.findOne({ where: { id } });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found!",
      });
    }

    // Verify current password (simple comparison since no hashing)
    if (employee.password !== currentPassword) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect!",
      });
    }

    // Update employee password directly
    await Employee.update(
      {
        password: newPassword,
        updatedBy: req.user?.id || null,
      },
      { where: { id } }
    );

    return res.status(200).json({
      success: true,
      message: "Password changed successfully!",
    });
  } catch (error) {
    console.error("Error changing employee password:", error);
    next(error);
  }
};



module.exports = {
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  updateEmployeeStatus,
  bulkImportEmployees,
  getEmployeeStats,
  searchEmployees,
  changeEmployeePassword
};